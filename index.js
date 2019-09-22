
// import statement express library for web application
const express = require('express');
const bodyParser = require('body-parser');
const mustache = require('mustache');
const fs = require('fs');
const mongo = require('mongodb');
const crypto = require('crypto');
const session = require('client-sessions');


// Creates new web app
const app = express();

// If nothing routes after the root default to static directory
app.use(express.static('static'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    cookieName: 'session', 
    secret: 'password',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,

}));


function connectToDatabase(onConnected) {

    let MongoClient = mongo.MongoClient;
    let url = 'mongodb://root:password@localhost:27017/InstantMessenger?authMechanism=SCRAM-SHA-256&authSource=admin';

    MongoClient.connect(url, { useNewUrlParser: true }, async (err, db) => {
        if (err) {
            console.log(err);
            process.exitCode = -1;
            return;
        }   
        console.log('Connected to database');

        let instantMessengerDatabase = db.db('InstantMessenger');
        onConnected(instantMessengerDatabase);
    });
}

app.post('/login', (req, res) => {
    let userName = req.body.userName;

    let password = req.body.password;
    let hashedPassword = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
    console.log(password);
    console.log(hashedPassword);
    
    let loginCredentials = {
        userName: userName,
        password: hashedPassword
    };

    connectToDatabase(async (db) => {
        let users = await db.collection("Users");
        let user = await users.findOne(loginCredentials);
        if (user) {
            req.session.user = user;
            res.redirect('/findChat');
        }
        else {
            res.redirect('/');
        }
    });
});

app.get('/findChat', (req, res) => {

    let template = fs.readFileSync('/Users/Kyle/Documents/InstantMessenger/templates/findChat.mustache', 'utf8')

    let html = mustache.render(template);
    res.send(html);
});

app.post('/findChat', (req, res) => {

    let userName = req.body.userName;

    connectToDatabase(async (db) => {
        let users = await db.collection("Users");
        let user = await users.findOne({userName: userName});
        if (user) {
            res.redirect('/chat/' + userName);
        }
        else {
            res.redirect('/');
        }
    });
});

app.post('/chat/:userName', (req, res) => {

    let messageContent = req.body.message;
    let recipent = req.params.userName;
    let sender = req.session.user.userName;

    let message = {
        timeStamp: new Date(),
        messageContent: messageContent,
        recipent: recipent,
        sender: sender
    };

    connectToDatabase(async (db) => {
        let messageCollection = await db.collection("Message");
        messageCollection.insertOne(message,(err, dbRes) => {
            res.redirect('/chat/' + recipent);
        });

    });

});


app.get('/chat/:userName', (req, res) => {

    let template = fs.readFileSync('/Users/Kyle/Documents/InstantMessenger/templates/chat.mustache', 'utf8')

    connectToDatabase(async (db) => {
        let messageCollection = await db.collection("Message");

        let messageQuery = {
            $or: [
              {sender: req.session.user.userName, recipent: req.params.userName},
              {sender: req.params.userName, recipent: req.session.user.userName}
            ]
        };

        let messages = await messageCollection.find(messageQuery).toArray();
        console.dir(messages);

        let context = {
            messages: messages
        }

        let html = mustache.render(template, context);
        res.send(html);
    });
});

// Listening to incoming request
// port number needs to be at lest 1000
app.listen(3000, () => {
    console.log('Listening on port 3000...');
});
