const express = require('express');

const bodyParser = require('body-parser');

const request = require('request');

const fs = require('fs');

const util = require('util');

const readFile = util.promisify(fs.readFile);

const { PAGE_ACCESS_TOKEN } = process.env.PAGE_ACCESS_TOKEN;
const { WEATHER_API_KEY } = process.env.WEATHER_API_KEY;

// Creates express http server
const app = express().use(bodyParser.json());

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening...'));

// Sends response via the Send API
function callSendAPI(REQUEST_BODY) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: REQUEST_BODY,
  }, (err) => {
    if (!err) {
      console.log('message sent! ');
      // console.log(request_body.message);
    } else {
      console.error(`Unable to send message:${err}`);
    }
  });
};

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
};
  
  
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
};
  
// Gets the best weather condition of the week
async function getBestWeather() {
  let bestDay;
  const json = await getApiData();
  console.log(json);
  const list = json.list;
  let fullDate = new Date(list[0].dt_txt);
  let temp = list[0].main.temp_max;

  for (var i = 1; i < list.length; i++) {
    const listDate = new Date(list[i].dt_txt);
    if (list[i].main.temp_max >= temp && listDate.getDay() != 6 && listDate.getDay() != 0) {
      temp = list[i].main.temp_max;
      fullDate = listDate;
    }
  }
  
  // Gets the day of the week
  const weekdays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  let day;
  for (var i = 0; i < weekdays.length; i++) {
    if (fullDate.getDay() == i) {
      day = weekdays[i];
    }
  }
  
  // Gets the date
  const date = fullDate.getDate();
  
  // Gets the month
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    let month;
    for (var i = 0; i < months.length; i++) {
      if (fullDate.getMonth() == i) {
        month = months[i];
      }
    }
  
    // Sends best day data as json
    bestDay = {
      day,
      date,
      month,
      temp: `${temp}C°`,
    };
    return bestDay;
  };
 
  // Finds the response corresponding with the intent
  async function getIntentResponse(value, intents) {
  const jsonBestDay = await getBestWeather();
  let response;
  for (const intent in intents) {
    if (intent == value) {
      if (intent == 'school_location') {
        const day = jsonBestDay.day;
        const date = jsonBestDay.date;
        const month = jsonBestDay.month;
        const temp = jsonBestDay.temp;
        const text = `${intents[intent][Math.floor(Math.random() * intents[intent].length)]}Vous pouvez venir nous rendre visite le ${day} ${date} ${month}. Ca sera le jour le plus chaud de la semaine avec ${temp}`;
        response = {
          text,
          };
        } else {
          response = {
            text: intents[intent][Math.floor(Math.random() * intents[intent].length)],
          };
        }
      }
    } 
    return response;
  };
  
  // Handles messages events
  async function handleMessage(SENDER_PSID, received_message) {
    let value;
    let confidence;
    let response;
    const fileContent = await readFile('json/intents.json');
    const intents = JSON.parse(fileContent);
  
    console.log(received_message.nlp.entities);
  
    if (received_message.text) {
      // Verifies if there is an intent
      if (received_message.nlp.entities.intent) {
        value = received_message.nlp.entities.intent[0].value;
        confidence = received_message.nlp.entities.intent[0].confidence;
      }
  
      // Checks if the intent is known
      response = await getIntentResponse(value, intents);
      // Default response
      if (response == null) {
        response = {
          text: "Je n'ai pas bien compris votre demande...",
        };
      }
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
  };
  
  // Handles messaging_postbacks events
  function handlePostback(SENDER_PSID, received_postback) {
  
  };

// Creates the endpoint for the webhook
app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      const WEBHOOK_EVENT = entry.messaging[0];
      console.log(WEBHOOK_EVENT);
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
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});