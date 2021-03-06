/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var app = express();

// All environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// Development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// Routes
app.get('/robot', function(req,res){
 res.sendfile(__dirname + '/views/robot.html');
});

app.get('/controller', function(req,res){
 res.sendfile(__dirname + '/views/controller.html');
});

// Start server and IO
var server = http.createServer(app).listen(app.get('port'));
var io = require('socket.io').listen(server);

// Set up redis  store
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
var armMode = 0;
// 0 = cartesian, 1 = wrist, 2 = gripper

io.sockets.on('connection', function (socket) {

	// Send list of recorded tasks on connection
  redis.lrange('tasks', 0, -1, function (err, reply) {
		io.sockets.emit('tasks', { tasks: reply });
	});

  // Start recording of task
  socket.on('startRecording', function (data) {
    recordingActive = true;
    playbackActive = false;
    activeTask = data.task;
    armMode = 0;

    redis.del(activeTask, function(err, reply) {
      redis.lrem('tasks', 0, activeTask, function(err, reply) {
        // Add task to task list
        redis.lrange('tasks', 0, -1, function (err, reply) {
          redis.rpush('tasks', activeTask);
          redis.rpush(activeTask, '[0,0,0,[0,0],0]');
        });

        io.sockets.emit('recordingStarted');
      });
    });

  });

  // End recording of task
  socket.on('endRecording', function (data) {  
    recordingActive = false;
    activeTask = null;

    // Send list of recorded tasks on connection
    redis.lrange('tasks', 0, -1, function (err, reply) {
      io.sockets.emit('tasks', { tasks: reply });
    });

    io.sockets.emit('recordingEnded');
  });

  // Capture joystick movements
  socket.on('movement', function(data) {
    if (activeTask != null) {
      if (recordingActive) {

        // Remove pauses from recording
        if ((data.axes[0] != 0) || (data.axes[1] != 0) || (data.axes[2] != 0) || (data.buttons[0] != 0) || (data.buttons[1] != 0)) {
          var movement = data.axes;
          movement.push(data.buttons);
          movement.push(armMode);
          console.log(armMode);
          redis.rpush(activeTask, JSON.stringify(movement));
        }

      } else {

        // if joystick returned to 0
        if (playbackActive && (data.axes[0] == 0) && (data.axes[1] == 0) && (data.axes[2] == 0)) {
          playbackActive = false;
          io.sockets.emit('playbackPaused');

        // if joystick moved forward after being at 0
        } else if (!playbackActive && (data.axes[1] > 0.3)) {
          playbackActive = true;
          redis.lrange(activeTask, 0, -1, function (err, reply) {
            io.sockets.emit('playbackStarted', { movements: reply });
          });
        // if joystick moved backwards after being at 0
        } else if (!playbackActive && (data.axes[1] < -0.3)) {
          playbackActive = true;
          redis.lrange(activeTask, 0, -1, function (err, reply) {
            io.sockets.emit('rewindStarted', { movements: reply });
          });
        }

      }
    }
  });

  // Start playback of recorded task
  socket.on('startPlayback', function (data) {
    activeTask = data.task;
  });

  // Playback was restarted
  socket.on('restartTaskPlayback', function (data) {
    socket.emit('restartPlayback');
  });

  // Pause playback of recorded task
  socket.on('pausePlayback', function (data) {
    playbackActive = false;
    io.sockets.emit('playbackPaused');
  });

  // Recording has finished executing
  socket.on('finishPlayback', function (data) {
    if (activeTask) {
      io.sockets.emit('playbackFinished');
      io.sockets.emit('activateCartesian');
    }
    playbackActive = false;
    activeTask = null;
  });

  // Move arm to home position
  socket.on('moveHome', function (data) {
    io.sockets.emit('moveToHomePosition');
  });

  // Arm already at home position
  socket.on('alreadyAtHome', function (data) {
    io.sockets.emit('alreadyFinishedMovingHome');
  });

  // Finished moving arm to home position
  socket.on('movedHome', function (data) {
    io.sockets.emit('finishedMovingHome');
  });

  // Switch to cartesian mode
  socket.on('cartesianMode', function(data) {
    playbackActive = false;
    
    if (!recordingActive) {
      activeTask = null;
    }
      armMode = 0;
    

    io.sockets.emit('playbackPaused');
    io.sockets.emit('activateCartesian');
  });

   // Switch to gripper mode
  socket.on('gripperMode', function(data) {
    playbackActive = false;
    
    if (!recordingActive) {
      activeTask = null;
    }
      armMode = 2;
    

    io.sockets.emit('playbackPaused');
    io.sockets.emit('activateGripper');
  });

   // Switch to wrist mode
  socket.on('wristMode', function(data) {
    playbackActive = false;
    
    if (!recordingActive) {
      activeTask = null;
    }
      armMode = 1;
    

    io.sockets.emit('playbackPaused');
    io.sockets.emit('activateWrist');
  });

  // Delete a recorded task
  socket.on('delete', function (data) {
    redis.del(data.task, function(err, reply) {
      redis.lrem('tasks', 0, data.task, function(err, reply) {
        redis.lrange('tasks', 0, -1, function (err, newTasks) {
          io.sockets.emit('tasks', { tasks: newTasks });
        });
      });
    });
  });

});