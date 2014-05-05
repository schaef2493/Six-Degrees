MICO Redesigned Controller
===========

A prototype of a proposed controller design for the MICO robotic arm. Developed as part of our BHCI Capstone Project in partnership with Laura Herlant and Tekin Mericli of the Robotics Institute at Carnegie Mellon University.

app.js: The server code

public/javascripts/controller.js: The controller UI code

public/javascripts/robot.js: The ROS interconnect codd

###Deploying the app to Heroku

Ensure you have Node.js and Redis installed on your local machine.

1. Create a Heroku account at www.heroku.com

2. Download the Heroku toolbelt from https://toolbelt.heroku.com

3. Run `heroku login` from the root directory

4. Enter your heroku login credentials

5. If asked to generate a new SSH key, say yes

6. Run `git init` from the root directory

7. Run `git add .` from the root directory

8. Run `git commit -m "initial commit"` from the root directory

9. Run `heroku create` from the root directory

10. Run `git push heroku master` to push the app to Heroku

11. Run `heroku ps:scale web=1` to start a Heroku dyno

12. Run `heroku restart` to restart the app's dyno on Heroku

13. Run `heroku open` to launch the app in your browser

You can change the name of the app from the Heroku web console

If you wish to run the app locally, start a redis server locally, then run `foreman start` from the root directory.