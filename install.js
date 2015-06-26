/*
 * Database setup script that might need to be ran if the server is moved
 * Primarily only creates unique keys.
*/
var mongodb = require('mongodb');

// Connect to the db
var dbUrl = 'mongodb://localhost/catbox';
var MongoClient = mongodb.MongoClient;

try {
	MongoClient.connect(dbUrl, function(err, db) {
		if(err) return console.log(err);

		var users = db.collection('user');
		var boxes = db.collection('box');

		users.createIndex({ email: 1 }, { unique: true });
		users.createIndex({ name: 1 });

		boxes.createIndex({ name: 1 }, { unique: true });
		boxes.createIndex({ user_id: 1 });
		boxes.createIndex({ centroid: "2dsphere" });
		boxes.createIndex({ shape: "2dsphere" });
		boxes.createIndex({ content: 1 });

		console.log('Done dana done.');
		db.close();
	});
} catch (e) {
	console.log(e);
}