var config = require('./config');
var util = require('./util');
var auth = require('./auth');
var Region = require('./region');

var express  = require('express');
var monk = require('monk');
var passwordless = require('passwordless');

module.exports = function(app) {

	app.get('/',
		function home(req, res, next) {
			console.log('Request - Home');
			res.end('What are you doing here?');
	});

	app.get('/restricted', passwordless.restricted(),
		function restricted(req, res) {
			console.log('Request - Restricted');
			res.end('You have access, my friend.');
	});

	// Android app login redirect
	app.get('/app_login',
		function appLogin(req, res) {
			// Deep link within app, will open /login using app's http client
			var url = 'catbox://login/?t=' + req.query.t + '&u=' + req.query.u;
			res.redirect(url);
	});

	// Accept token on /login
	app.get('/login', 
		passwordless.acceptToken({
			successRedirect: '/login_success'
		}),
		function loginFailed(req, res) {
			// We reach in case acceptToken fails
			res.json({
				'result': 'failed',
				'reason': 'Invalid token or user.'
			});
	});

	// Success message after passwordless accepts the token
	app.get('/login_success', passwordless.restricted(),
		function loginSuccess(req, res) {
			var db = monk(config.db);
			var users = db.get('user');

			console.log('Login - Successful');
			users.findOne({
				_id: req.user
			}, function(err, document, callback) {
				if (err) console.log(err);

				db.close();
				res.json({
					'result': 'success',
					'user': document
				});
			});
	});

	// Login token delivery
	app.post('/request_token', passwordless.requestToken(auth.sendToken),
		function requestTokenSent(req, res) {
			console.log('Login - Email sent');
			res.json({
				'result': 'success'
			});
	});


	// User Functions
	app.post('/change_name', passwordless.restricted(),
		function changeName(req, res) {
			var db = monk(config.db);
			var users = db.get('user');

			console.log('Update - Name');
			users.update({
				_id: req.user
			}, {
				$set: {
					name: req.body.name,
				}
			}, function(err, count, callback) {
				if (err) console.log(err);

				db.close();
				res.json({
					'result': 'success'
				});
			});
	});


	app.post('/me', passwordless.requestToken(auth.sendToken),
		function requestUser(req, res) {
			var db = monk(config.db);
			var users = db.get('user');

			console.log('Request - Me');
			users.findOne({
				_id: req.user
			}, function(err, document, callback) {
				if (err) console.log(err);

				db.close();
				res.json({
					'result': 'success',
					'user': document
				});
			});
	});


	// Nearby boxes
	app.get('/boxes', passwordless.restricted(),
		function boxes(req, res) {
			var db = monk(config.db);
			var boxes = db.get('box');
			var point;

			console.log('Request - Nearby Boxes');
			try {
				point = JSON.parse(req.query.coordinates);

				boxes.find({
					centroid: {
						$near: {
							$geometry: {
								type: "Point",
								coordinates: [point[0], point[1]]
							}
						}
					}
				},
				function(err, results, callback) {
					if (err) console.log(err);

					db.close();
					res.json(results);
				});
			} catch (e) {
				console.log(e);
				res.json({
					'result': 'failed'
				});
			}
	});

	// Nearby boxes
	app.get('/boxes_within', passwordless.restricted(),
		function boxes(req, res) {
			var db = monk(config.db);
			var boxes = db.get('box');
			var points = [];
			var rawPoints;

			console.log('Request - Boxes Within');
			try {
				rawPoints = JSON.parse(req.query.coordinates);
				for (var i in rawPoints) {
					points.push([ rawPoints[i][0], rawPoints[i][1] ]);
				}
				points.push(points[0]); // repeat first point at the end

				boxes.findOne({
					shape: {
						$geoWithin: {
							$geometry: {
								type: "Polygon",
								coordinates: [ 
									points
								]
							}
						}
					}
				}, function(err, document, callback) {
					if (err) console.log(err);

					db.close();
					res.json(document);
				});
			} catch (e) {
				console.log(e);
				res.json({
					'result': 'failed'
				});
			}
	});

	// Nearby boxes
	app.post('/add_box', passwordless.restricted(),
		function addBox(req, res) {
			var db;
			var boxes;
			var data = req.body;
			var shape = new Region();
			var rawPoints;

			console.log('Add - Box');
			console.log(data);
			try {
				rawPoints = JSON.parse(data.coordinates);
				console.log(rawPoints);
				for (var i in rawPoints) {
					shape.points.push([ rawPoints[i][0], rawPoints[i][1] ]);
				}
				shape.points.push(shape.points[0]); // repeat first point at the end

				console.log("Checking duplicates");
				console.log(shape.points);

				// Validate data required fields
				if (!( util.isEmpty(shape) || util.isEmpty(data.name) )) {
					db = monk(config.db);
					boxes = db.get('box');

					boxes.findOne({
						$or: [{
							name: data.name
						}, {
							shape: {
								$geoIntersects: {
									$geometry: {
										type: "Polygon",
										coordinates: [
											shape.points
										]
									}
								}
							}
						}]
					}, function(err, document, callback) {
						if (err) console.log(err);

						console.log(document);

						if (util.isEmpty(document)) {
							// Continue with insertion
							boxes.insert({
								user_id: req.user,
								name: data.name,
								content: data.content,
								centroid: {
									type: "Point",
									coordinates: shape.centroid()
								},
								shape: {
									type: "Polygon",
									coordinates: [ shape.points ]
								}
							}, function(err, inserted) {
								if (err) console.log(err);

								db.close();
								res.json({
									'result': 'success'
								});
							});
						} else {
							// Duplicate name, return duplicate message
							db.close();
							res.json({
								'result': 'duplicate',
								'message': 'A box within these dimensions or with the same name already exists.'
							});
						}
					});
				} else {
					res.json({
						'result': 'failed',
						'message': 'Cannot parse request, invalid shape or name. Please make sure the order of longitude latitude pairs is correct.'
					});
				}
			} catch (e) {
				console.log(e);
				res.json({
					'result': 'failed'
				});
			}

	});


	// Catch 404 and forward to error handler
	app.use(
		function notFound(req, res, next) {
			var err = new Error('404 - Not found.');
			err.status = 404;
			console.log('404 - Not found.');
			next(err);
	});

	// Dev error handler
	app.use(
		function errorHandler(err, req, res, next) {
			res.status(err.status || 500);
			next(err);
	});
};