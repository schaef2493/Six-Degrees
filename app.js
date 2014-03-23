/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routes
app.get('/robot', function(req,res){
 res.sendfile(__dirname + '/views/robot.html');
});

app.get('/controller', function(req,res){
 res.sendfile(__dirname + '/views/controller.html');
});

// start server and IO
var server = http.createServer(app).listen(app.get('port'));
var io = require('socket.io').listen(server);

// set up redis  store
if (process.env.REDISTOGO_URL) {
    var rtg   = require('url').parse(process.env.REDISTOGO_URL);
	var redis = require('redis').createClient(rtg.port, rtg.hostname);

	redis.auth(rtg.auth.split(":")[1]);
} else {
    var redis = require("redis").createClient();
}

io.sockets.on('connection', function (socket) {

	// send list of recorded tasks
  redis.get('tasks', function (err, reply) {
		io.sockets.emit('tasks', { tasks: reply });
	});
  
  // start playback of recorded task
  socket.on('startPlayback', function (data) {
    redis.get(data.task, function (err, reply) {
    	io.sockets.emit('startPlayback', { taskMovements: reply });
    });
  });

  // pause playback of recorded tasks
  socket.on('pausePlayback', function (data) {
    io.sockets.emit('pausePlayback');
  });

  // start recording of task
  socket.on('startRecording', function (data) {
  	redis.set(data.task, null);
    io.sockets.emit('startRecording', { task: data.task });
  });

  // pause recording of task
  socket.on('pauseRecording', function (data) {
  	redis.set(data.task, data.taskMovements);
  });

});