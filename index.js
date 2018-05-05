'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const request = require('request');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

//creates express http server
const app = express().use(bodyParser.json());

//sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening...'));

//creates the endpoint for our webhook
app.post('/webhook', (req, res) => {
    if(req.body.object === 'page') {
        req.body.entry.forEach(entry => {
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);
            //get the user ID
            let sender_psid = webhook_event.sender.id;

            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }            
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "xUf8Fr6NMaRAfTY41zBvFPDQIssJRjLf";

    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if(mode && token) {
        if(mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

function getBestWeather(){
    let url = 'http://api.openweathermap.org/data/2.5/forecast?q=Nanterre,fr&units=metric&mode=json&lang=fr&APPID='+WEATHER_API_KEY;
    request.get(url, (err, response, body) => {
        if(err) throw err;
        let result = JSON.parse(body);
        console.log('weather : ' + result);

    })
}

function getIntentResponse(value, intents){
    let response;
    for(var intent in intents) {
        if(intent == value){
            if(intent == 'school_location') {
                response = {
                    "text": intents[intent][Math.floor(Math.random()*intents[intent].length)] + "Vous pouvez venir nous rendre visite ce jour là."
                }
            }
            response = {
                "text": intents[intent][Math.floor(Math.random()*intents[intent].length)]
            }
        }
        
    };
    return response;
}

// Handles messages events
async function handleMessage(sender_psid, received_message) {
    let value;
    let confidence;
    let response;
    const fileContent = await readFile('json/intents.json');
    const intents = JSON.parse(fileContent);
    
    console.log(received_message.nlp.entities);
    getBestWeather();
    
    if (received_message.text) {
        // Verifies if there is an intent
        if (received_message.nlp.entities.intent) {
            value = received_message.nlp.entities.intent[0]["value"];
            confidence = received_message.nlp.entities.intent[0]["confidence"];
        }

        //Checks if the intent is known
        response = getIntentResponse(value, intents);
        //Default response
        if(response == null) {
            response = {
                "text": "Je n'ai pas bien compris votre demande..."
            }
        }
    }
    
    // Construct the message body
    let request_body = {
        "messaging_type": "RESPONSE",
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }
    
    // Sends the response message
    callSendAPI(request_body);    
  }

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response via the Send API
function callSendAPI(request_body) {
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent! ');
        } else {
            console.error("Unable to send message:" + err);
        }
  }); 
}