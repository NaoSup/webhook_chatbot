const express = require('express');

const bodyParser = require('body-parser');

const request = require('request');

const fs = require('fs');

const util = require('util');

const readFile = util.promisify(fs.readFile);

const { PAGE_ACCESS_TOKEN, WEATHER_API_KEY } = process.env;

// Creates express http server
const app = express().use(bodyParser.json());

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337);

// Sends response via the Send API
function callSendAPI(REQUEST_BODY) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: REQUEST_BODY,
  }, (err) => {
    if (err) {
      throw err;
    }
  });
}

// Send sender action typing on
function senderAction(SENDER_PSID) {
  const REQUEST_BODY = {
    messaging_type: 'RESPONSE',
    recipient: {
      id: SENDER_PSID,
    },
    sender_action: 'typing_on',
  };
  callSendAPI(REQUEST_BODY);
}

// Gets the data from the weather API
function getApiData() {
  const url = `http://api.openweathermap.org/data/2.5/forecast?q=Nanterre,fr&units=metric&mode=json&lang=fr&APPID=${WEATHER_API_KEY}`;
  return new Promise((resolve, reject) => {
    request.get(url, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(body));
      }
    });
  });
}

// Gets the best weather condition of the week
async function getBestWeather() {
  const json = await getApiData();
  const { list } = json;
  let fullDate = new Date(list[0].dt_txt);
  let temp = list[0].main.temp_max;

  for (let i = 1; i < list.length; i += 1) {
    const listDate = new Date(list[i].dt_txt);
    if (list[i].main.temp_max >= temp && listDate.getDay() !== 6 && listDate.getDay() !== 0) {
      temp = list[i].main.temp_max;
      fullDate = listDate;
    }
  }

  // Gets the day of the week
  const weekdays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  let day;
  for (let i = 0; i < weekdays.length; i += 1) {
    if (fullDate.getDay() === i) {
      day = weekdays[i];
    }
  }

  // Gets the date
  const date = fullDate.getDate();

  // Gets the month
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  let month;
  for (let i = 0; i < months.length; i += 1) {
    if (fullDate.getMonth() === i) {
      month = months[i];
    }
  }

  // Sends best day data as json
  const bestDay = {
    day,
    date,
    month,
    temp: `${temp}C°`,
  };
  return bestDay;
}

// Finds the response corresponding with the intent
async function getIntentResponse(value, confidence, entities, intents) {
  const jsonBestDay = await getBestWeather();
  const { day, date, month, temp } = jsonBestDay;
  const responseWeather = `Vous pouvez venir nous rendre visite le ${day} ${date} ${month}. Ca sera le jour le plus chaud de la semaine avec ${temp}`;
  let response;
  for (const intent in intents) {
    if (intent === value && confidence > 0.8) {
      switch (intent) {
        case 'school_location':
          if(entities.come){
            response = intents[intent][0].transport;
            response.text += " " + responseWeather;
          } else {
            response = intents[intent][0].default;
            response.attachment.payload.text += " " + responseWeather;
          }
          break;
        default:
          response = intents[intent][Math.floor(Math.random() * intents[intent].length)];
          break;
        }
      }
    }
  return response;
}

// Handles messages events
async function handleMessage(SENDER_PSID, RECEIVED_MESSAGE) {
  let value;
  let confidence;
  let response;
  let entities = RECEIVED_MESSAGE.nlp.entities;
  const fileContent = await readFile('json/intents.json');
  const intents = JSON.parse(fileContent);

  console.log(RECEIVED_MESSAGE);
  console.log(RECEIVED_MESSAGE.nlp.entities);

  if (RECEIVED_MESSAGE.text) {
    // Verifies if there is an intent
    if (entities.intent) {
      value = entities.intent[0].value;
      confidence = entities.intent[0].confidence;
    }

    // Checks if the intent is known
    response = await getIntentResponse(value, confidence, entities, intents);

    console.log(response);
    // Default response
    if (response == null) {
      response = {
        text: "Je n'ai pas bien compris votre demande...",
      };
    }
    console.log(response);
  }
  console.log(response);
  // Construct the message body
  const REQUEST_BODY = {
    messaging_type: 'RESPONSE',
    recipient: {
      id: SENDER_PSID,
    },
    message: response,
  };

  // Sends the response message
  callSendAPI(REQUEST_BODY);
}

// Handles messaging_postbacks events
async function handlePostback(SENDER_PSID, RECEIVED_POSTBACK) {
  let response;
  let payload = RECEIVED_POSTBACK.payload;
  const fileContent = await readFile('json/intents.json');
  const intents = JSON.parse(fileContent);
  switch (payload) {
    case 'bachelor':
      response = intents['school_prices'][0].bachelor;
      break;
    case 'mastere':
      response = intents['school_prices'][0].mastere;
      break;
    case 'howtogethere':
      response = intents['school_location'][0].transport;
      break; 
    default:
      break;
  }

  // Construct the message body
  const REQUEST_BODY = {
    messaging_type: 'RESPONSE',
    recipient: {
      id: SENDER_PSID,
    },
    message: response,
  };

  // Sends the response message
  callSendAPI(REQUEST_BODY);
}

// Creates the endpoint for the webhook
app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      const WEBHOOK_EVENT = entry.messaging[0];
      // Gets the user ID
      const SENDER_PSID = WEBHOOK_EVENT.sender.id;

      // Sender action
      senderAction(SENDER_PSID);

      // Handles sender response
      if (WEBHOOK_EVENT.message) {
        handleMessage(SENDER_PSID, WEBHOOK_EVENT.message);
      } else if (WEBHOOK_EVENT.postback) {
        handlePostback(SENDER_PSID, WEBHOOK_EVENT.postback);
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'xUf8Fr6NMaRAfTY41zBvFPDQIssJRjLf';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});
