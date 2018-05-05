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

//Gets the best weather condition of the week
async function getBestWeather(){
    let url = 'http://api.openweathermap.org/data/2.5/forecast?q=Nanterre,fr&units=metric&mode=json&lang=fr&APPID='+WEATHER_API_KEY;
    
    request.get(url, (err, response, body) => {
        if(err) throw err;
        const result = JSON.parse(body);
        const list = result.list;
        let fullDate = new Date(list[0].dt_txt);
        let temp = list[0].main.temp_max;
        
        for(var i = 1; i < list.length; i++){
            let listDate = new Date(list[i].dt_txt); 
            if(list[i].main.temp_max >= temp && listDate.getDay() != 6 && listDate.getDay() != 0){
                temp = list[i].main.temp_max;
                fullDate = listDate;
            }
        }
        
        //Gets the day of the week
        const weekdays = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
        let day;
        for(var i = 0; i < weekdays.length; i++) {
            if(fullDate.getDay() == i) {
                day = weekdays[i];
            }
        }

        //Gets the date
        let date = fullDate.getDate();

        //Get the month
        const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
        let month;
        for(var i = 0; i < months.length; i++) {
            if(fullDate.getMonth() == i) {
                month = months[i];
            }
        }
        let bestDay = {
            "day": day,
            "date": date,
            "month": month,
            "temp": temp + "C°"
        }
        
        return await bestDay;
    })
}

async function getIntentResponse(value, intents){
    let jsonBestDay = getBestWeather();
    let response;

    for(var intent in intents) {
        if(intent == value){
            if(intent == 'greetings') {
                let day = jsonBestDay.day;
                let date = jsonBestDay.date;
                let month = jsonBestDay.month;
                let temp = jsonBestDay.temp;
                
                response = {
                    "text": intents[intent][Math.floor(Math.random()*intents[intent].length)] + "Vous pouvez venir nous rendre visite le " + day + " " + date + " " + month + ". Ca sera le jour le plus chaud de la semaine avec " + temp
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
    const bestDay = util.promisify(getBestWeather());
    
    console.log(received_message.nlp.entities);
    getBestWeather();
    
    if (received_message.text) {
        // Verifies if there is an intent
        if (received_message.nlp.entities.intent) {
            value = received_message.nlp.entities.intent[0]["value"];
            confidence = received_message.nlp.entities.intent[0]["confidence"];
        }

        //Checks if the intent is known
        response = getIntentResponse(value, intents, bestDay);
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