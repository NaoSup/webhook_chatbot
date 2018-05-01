'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const request = require('request');

dotenv.config();

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
            
            let sender_psid = webhook_event.sender.id;
            console.log('PSID : ' + sender_psid);

            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
                console.log('Webhook event is a message');     
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
                console.log('Webhook event is a postback');
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

function firstEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
  }
  

// Handles messages events
function handleMessage(sender_psid, received_message) {

    let response;
    const greetings = firstEntity(received_message.nlp, 'Greetings');
    console.log('Function handleMessage started...');
    console.log(received_message.nlp.entities.intent);
    // Check if the message contains text
    if (received_message.text) {    
        console.log('Message contains a text');
        if(greetings && greetings.confidence > 0.8) {
            response = {
                "text": "Bonjour !"
            }
        } else {
            response = {
                "text": `You sent the message: "${received_message.text}". Now send me an image!`
            }
        }
    }  
    
    // Sends the response message
    callSendAPI(sender_psid, response);    
  }

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    console.log('Function callSendAPI started...');
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
            console.log('message sent! ' + response.text);
        } else {
            console.error("Unable to send message:" + err);
        }
  }); 
}