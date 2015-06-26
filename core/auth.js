var config = require('./config');
var util = require('./util');

var express  = require('express');
var monk = require('monk');
var sendgrid = require('sendgrid')(config.sendgridApi);

// Send token, also the basic registration function
var sendToken = function(user, delivery, tokenCallback, req) {
	// Add user to db if required, otherwise find user and send token
	var db = monk(config.db);
	var users = db.get('user');

	users.findOne({
		email: user
	}, function(err, document, callback) {
		if (err) console.log(err);

		if (util.isEmpty(document)) {
			// Insert if doesn't exist and callback
			users.insert({
				email: user,
				name: user
			}, function(err, inserted) {
				if (err) console.log(err);

				db.close();
				tokenCallback(null, inserted._id);
			});
		} else {
			// Callback using id if it exists
			db.close();
			tokenCallback(null, document._id);
		}
	});
};

// Executed by passwordless when sendToken's tokenCallback is called
var sendLoginEmail = function(token, uid, recipient, callback) {
	// Send email using Sendgrid API
	sendgrid.send({
		to:	recipient,
		from: 'no-reply@flooat.com',
		fromname: 'Catbox',
		subject: 'Catbox Authentication',
		html: '<h2>Hello!</h2><p>Please press the button below to login.</p><p><a href="' 
		+ config.site + '/app_login?t=' + token + '&u=' + encodeURIComponent(uid)
		+ '" style="display:inline-block;padding:20px 30px;background:#444;color:#fff;text-decoration:none;font-weight:700;border-radius:5px;">Login to Catbox</a></p><hr style="margin-top:40px"><p>P.S. The button will only work if you are on an Android phone. <a href="' 
		+ config.site + '/?token=' + token + '&uid=' + encodeURIComponent(uid)
		+ '">_</a></p>',
	}, function(err, json) {
		if (err)
			console.log(err);
		console.log(json);
		callback(err);
	});
}

module.exports = {
	sendLoginEmail: sendLoginEmail,
	sendToken: sendToken
};