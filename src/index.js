'use strict';

//INIT EXPRESS
var express = require('express');
var app = express();
//INIT HTTP SERVER CODE
var http = require('http').Server(app);
//INIT SOCKET.IO
var io = require('socket.io')(http);

//PREPARE BOOTSTRAP STATIC LINK
app.use('/bootstrap', express.static(__dirname+'/node_modules/bootstrap'));
//PREPARE STATIC FILES FOR DISTRIBUTION
app.use('/static', express.static(__dirname + '/public'));

//INIT PUG TEMPLATE ENGINE
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');


//BEGIN HOSTING THE APP
var port = process.env.PORT;
http.listen(port,function(){
    console.log("The process is running on port:"+port);
});

//HOME ROUTE
app.get("/",function(req,res){
    res.render('home.jade');
});

//HOME ROUTE TOO
app.get("/home",function(req,res){
    res.render('home.jade');
});

//CONNECTION CONSTRUCTOR
function connection(socket,id){
    this.socket = socket;
    this.id = id;
}

var users = [];

//DRAWING GROUP CONSTRUCTOR
function group(id, leader){
    this.id = id;
    this.leader = leader;
    this.members = [leader];
    this.addMember = function(member){
        this.members.push(member);
    }
    this.removeMember = function(member){
        this.members.splice(this.members.indexOf(member),1);
        //If group lost all members, delete itself
        if(this.members.length < 1) {
            groups.splice(groups.indexOf(this),1);
        }
        //if member was leader, choose new leader
        if(member == this.leader){
            //Find the oldest member still around, and appiont them
            for(var i = 0; i < this.members.length; i++){
                if(this.members[i]!=undefined){
                    this.leader = this.members[i];
                    //Tell the person they are the new leader
                    this.leader.socket.emit('newLeader',true);
                    break;
                }
            }
        }
    }
    //Test if member is actually in a group
    this.checkMember = function(member){
        return (this.members.indexOf(member) != -1);
    }
    groups.push(this);
}

var groups = [];

//Find the group from the id
function findGroup(id){
    for(var i = 0; i < groups.length; i ++){
        if(groups[i].id == id){
            return groups[i];
        }
    }
    return -1;
}

//Find user by id
function findUser(id){
    for(var i = 0; i < users.length; i ++){
        if(users[i].id == id){
            return users[i];
        }
    }
    return -1;
}

//INITIALIZE ALL OF SOCKET.IO'S FUNCTIONS
io.on('connection', function(socket){
    //add to the user list
    var me = new connection(socket,socket.id);
    var myGroup;
    users.push(me);
    //user wants to create a group
    socket.on('createGroup',function(data){
       if(me.groupID==undefined){
            var groupNum;
            //generate random group codes until one is free
            do {
                groupNum = Math.round(((Math.random() * 900000) + 100000));
            } while(findGroup(groupNum)!=-1);
            console.log(groupNum);
            myGroup = new group(groupNum,me);
            me.groupID = groupNum;
            socket.emit('accGroup',me.groupID);
       } 
    });
    //user requested to join a group
    socket.on('reqGroup',function(data){
        if(findGroup(data)!=-1){
            findGroup(data).leader.socket.emit('reqGroup',me.id);
        } else {
            //group could not be found
            socket.emit('decGroup',data);
        }
    });
    //group leader accepted a member
    socket.on('accGroup',function(id){
        if(myGroup!=undefined){
            myGroup.addMember(findUser(id));
            findUser(id).socket.emit('accGroup',me.groupID);
        }
    });
    //group leader declined a member
    socket.on('decGroup',function(id){
        if(myGroup!=undefined){
            findUser(id).socket.emit('decGroup',me.groupID);
        }
    });
    //user giving group info
    socket.on('confirmGroup',function(id){
       me.groupID = id;
       myGroup = findGroup(id);
    });
    //user is trying to draw a line
    socket.on('drawLine',function(data){
        if(myGroup!=undefined){
            if(myGroup.checkMember(me)) {
                for(var i = 0; i < myGroup.members.length; i ++){
                    if(myGroup.members[i]!=me){
                        myGroup.members[i].socket.emit('drawLine',data);
                    }
                }
            }
        }
    });
    //Remove from the the user & group lists
    socket.on('disconnect',function(){
        users.splice(users.indexOf(me),1);
        if(me.groupID!=undefined){
            myGroup.removeMember(me);
        }
    });
});
