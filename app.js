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
  var redis = require('redis').createClient();
}

// TODO: Track/playback button states
// TODO: Hold button [1,1] for 5 sec to HOME

var recordingActive = false;
var activeTask = null;

io.sockets.on('connection', function (socket) {

	// send list of recorded tasks on connection
  redis.lrange('tasks', 0, -1, function (err, reply) {
		io.sockets.emit('tasks', { tasks: reply });
	});

  // start recording of task
  socket.on('startRecording', function (data) {
    recordingActive = true;
    activeTask = data.task;

    // add task to task list
    redis.lrange('tasks', 0, -1, function (err, reply) {
      redis.rpush('tasks', data.task);
    });

    io.sockets.emit('recordingStarted');
  });

  // end recording of task
  socket.on('endRecording', function (data) {  
    recordingActive = false;
    activeTask = null;

    io.sockets.emit('recordingEnded');
  });

  // capture joystick movements
  socket.on('movement', function(data) {
    console.log(data.axes);
    if (recordingActive) {
      var movement = data.axes;
      movement.push(data.buttons);
      redis.rpush(activeTask, JSON.stringify(movement));
    }
  });

  // start playback of recorded task
  socket.on('startPlayback', function (data) {
    activeTask = data.task;
    lastStepPerformed = null;
    
    redis.lrange(activeTask, 0, -1, function (err, reply) {
      io.sockets.emit('playbackStarted', { movements: reply });
    });

  });

  // resume playback of recorded task
  socket.on('resumePlayback', function (data) {
    activeTask = data.task;

    io.sockets.emit('playbackResumed');
  });

  // pause playback of recorded task
  socket.on('pausePlayback', function (data) {
    io.sockets.emit('playbackPaused');
  });

  // delete a recorded task
  socket.on('delete', function (data) {
    redis.del(data.task, function(err, reply) {
      redis.lrem('tasks', data.task, function(err, reply) {
        redis.lrange('tasks', 0, -1, function (err, newTasks) {
          io.sockets.emit('tasks', { tasks: newTasks });
        });
      });
    });
  });

});