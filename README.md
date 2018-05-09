Webhook Chatbot FAQ Ingésup
-
Simple webhook implementation to handle user requests.
You can test the chatbot on this [Facebook page](https://www.facebook.com/ingesupchatbot/).

What I used for this project
-
- [NodeJS](https://nodejs.org/en/)
- [Wit.ai](https://wit.ai)
- API [OpenWeatherMap](https://openweathermap.org/api)
- [Facebook for Developers](https://developers.facebook.com/)
- [Heroku](https//www.heroku.com)

Prerequisites
-
You will need to :
 - Install [Git](https://git-scm.com/downloads)
 - Install [NodeJS](https://nodejs.org/en/download/)
 - Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and create an account on [Heroku](https//www.heroku.com)
 - Create a [Facebook for Developers](https://developers.facebook.com/) account

Installing
-
**Deploy On Heroku**
Clone and deploy this repo on heroku. To deploy the app, you can follow [the Heroku tutorial](https://devcenter.heroku.com/articles/git).

Once it is deployed, you can add in your Config Variables :
 - `WEATHER_API_KEY` you will need a key from OpenWeatherMap as I am using some weather data for the chatbot
 
**Create a Messenger App**
I invite you to look at [this tutorial](https://developers.facebook.com/docs/messenger-platform/getting-started/app-setup) which will explain to you step by step how to create and configure you Messenger App.
You can find the verify token in :

    app.get('/webhook', (req, res) => {
    const  VERIFY_TOKEN  =  <VERIFY_TOKEN>;
    ...
    };
  You can use the the string I provided or any other random string of your choice.

Don't forget to add `PAGE_ACCESS_TOKEN`  (corresponding to the generated page token) to your Config Variables.
  
 You can now test the chatbot by sending a message from your Facebook page.
