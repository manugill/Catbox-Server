var config = require('./core/config');
var auth = require('./core/auth');
var routes = require('./core/routes');

var http = require('http');
var express = require('express');
var session = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var monk = require('monk');
var passwordless = require('passwordless');
var socketio = require('socket.io');
var PasswordlessStore = require('passwordless-mongostore');
var ConnectStore = require('connect-mongodb-session')(session);


// Server setup
var app = express();
var server = http.createServer(app);
var io = socketio(server);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());

// Sessions with store
var sessionStore = new ConnectStore({
	uri: 'mongodb://' + config.db,
	collection: 'express-session'
});
app.use(session({
	secret: '546789',
	resave: false,
	saveUninitialized: true,
	store: sessionStore
}));

// Passwordless with token store
var tokenStore = new PasswordlessStore('mongodb://' + config.db, {
	server: { auto_reconnect: true },
	mongostore: { collection: 'passwordless-token' }
});
passwordless.init(tokenStore, { allowTokenReuse: true });

// Delivery service using email
passwordless.addDelivery(auth.sendLoginEmail);

// Session support
app.use(passwordless.sessionSupport());


// Initialize API routes
routes(app);

// Start listening
server.listen(config.port, function() {
	console.log('Server listening at ' + config.port);
});

// Socket.io chat
// Based on http://socket.io/get-started/chat/
io.on('connection', function(socket) {
	var boxId = socket.handshake.query.boxId;
	socket.name = socket.handshake.query.name;
	socket.userId = socket.handshake.query.userId;

	// echo globally (all clients) that a person has connected
	socket.to(boxId).emit('user joined', {
		name: socket.name
	});

	socket.join(boxId);
	console.log('Chat - ' + socket.name + ' joined ' + boxId);

	// client emits 'new message', this listens and executes
	socket.on('new message', function (message) {
		socket.to(boxId).emit('new message', {
			name: socket.name,
			message: message
		});

		console.log('Chat - ' + socket.name + ' wrote: ' + message);
	});

	// client emits 'typing', we broadcast it to others
	socket.on('typing', function () {
		socket.to(boxId).emit('typing', {
			name: socket.name
		});
	});

	// client emits 'stop typing', we broadcast it to others
	socket.on('stop typing', function () {
		socket.to(boxId).emit('stop typing', {
			name: socket.name
		});
	});

	// when the user disconnects, broadcast left message
	socket.on('disconnect', function () {
		socket.leave(boxId);
		socket.to(boxId).emit('user left', {
			name: socket.name
		});

		console.log('Chat - ' + socket.name + ' left: ' + boxId);
	});
});
