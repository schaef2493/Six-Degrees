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

var recordingActive = false;
var playbackActive = false;
var activeTask = null;
var lastStepPerformed = null;

function playbackTask(step) {
  if (typeof step == 'undefined') {
    step = 0;
  }

  lastStepPerformed = step;

  // get total number of movements
  redis.llen(activeTask, function (err, numSteps) {
    
    console.log('Fetching step ' + step + ' of ' + activeTask);
    // fetch step movement
    redis.lindex(activeTask, step, function (err, reply) {
      
      // perform movement
      var axes = JSON.parse(reply);
      axes = axes.slice(0,3);
      io.sockets.emit('moveJoystick', { axes: axes });

      // check for another movement
      if (step < numSteps-1) {
        
        // schedule next movement
        redis.lindex(activeTask, step+1, function (err, reply) {
          setTimeout(playbackTask, reply[3], step+1);
        });

      } else {

        playbackActive = false;
        io.sockets.emit('playbackEnded');

      }

    });

  });
}

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
  });

  // end recording of task
  socket.on('endRecording', function (data) {  
    // append stop movement command  
    var movement = JSON.stringify([0,0,0,0])
    redis.rpush(activeTask, movement);
    recordingActive = false;
    activeTask = null;
  });

  // capture joystick movements
  socket.on('movement', function(data) {
    if (recordingActive) {
      var movement = data.axes;
      var time = (new Date).getTime() - ((data.header.stamp.secs*1000) + (data.header.stamp.nsecs/1000000));
      movement.push(time);
      redis.rpush(activeTask, JSON.stringify(movement));
    }
  });

  // start playback of recorded task
  socket.on('startPlayback', function (data) {
    playbackActive = true;
    activeTask = data.task;
    lastStepPerformed = null;
    playbackTask();
  });

  // resume playback of recorded task
  socket.on('resumePlayback', function (data) {
    playbackActive = true;
    activeTask = data.task;
    playbackTask(lastStepPerformed + 1);
  });

  // pause playback of recorded task
  socket.on('pausePlayback', function (data) {
    playbackActive = false;
  });

});