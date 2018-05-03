'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const request = require('request');
const fs = require('fs');

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

// Reads intents.json file
async function readIntents() {
    fs.readFile('json/intents.json', (err, values) => {
        if(err) throw err;
        return(JSON.parse(values));
    });
    
}

// Handles messages events
async function handleMessage(sender_psid, received_message) {
    let value;
    let confidence;
    let response;
    let intents = await readIntents();
    console.log(intents);
    console.log(received_message.nlp.entities);
    if (received_message.text) {
        if (received_message.nlp.entities.intent) {
            value = received_message.nlp.entities.intent[0]["value"];
            confidence = received_message.nlp.entities.intent[0]["confidence"];
        }
        for(var intent in intents) {
            if(intent == value){
                response = {
                    "text": intents[intent]
                }
            }
            else {
                response = {
                    "text": "Je n'ai pas bien compris votre demande..."
                }
            } 
        };
        /*if(confidence && confidence > 0.8){
            if(value == 'greetings' && confidence > 0.8) {
                response = {
                    "text": "Bonjour !"
                }
            } else if(value == 'school_description' && confidence > 0.8) {
                response = {
                    "text": "Ingésup est une école en ingénierie informatique. Elle fait partie du groupe Ynov."
                }
            } else if(value == 'degrees' && confidence > 0.8) {
                response = {
                    "text": "Nous proposons un bachelor (Bac+3) et un mastère (Bac+5). A la fin de la formation, nous délivrons le titre d’Expert Informatique et Systèmes d’Information."
                }
            } 
        } */ 
        
    }  
    
    // Sends the response message
    callSendAPI(sender_psid, response);    
  }

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

    // Send the HTTP request to the Messenger Platform
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