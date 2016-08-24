'use strict';

//INIT EXPRESS
var express = require('express');
var app = express();
//INIT HTTP SERVER CODE
var http = require('http').Server(app);
//INIT SOCKET.IO
var io = require('socket.io')(http);

//DRAWING VARS
const MAX_WEIGHT = 100; //Max weight of pen to prevent lag

//MESSAGING VARS
const MAX_MESSAGES = 100;
const MAX_CHARS = 140;  //Be sure to change on client end too if you wish to change

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

//MESSAGE CONSTRUCTOR
function message(author,msg){
    this.author = author;
    this.msg = msg;
}

//DRAWING GROUP CONSTRUCTOR
function group(id, leader){
    this.id = id;
    this.leader = leader;
    this.members = [leader];
    this.messages = [];
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
    
    //Send a message to everyone in the group
    this.emitAll = function(event,data,sender){
        if(this.checkMember(sender)) {
            for(var i = 0; i < this.members.length; i ++){
                if(this.members[i]!=sender){
                    this.members[i].socket.emit(event,data);
                }
            }
        } else {
            sender.socket.emit('err',"Could not verify you as part of group "+id+ ", sorry about that!");
        }
    }
    
    //Add a message to the message array
    this.addMessage = function(msg,author){
        if(this.checkMember(author)){
            if(this.messages.length>MAX_MESSAGES){
                this.messages.splice(0,1);
            }
            if(author == this.leader){
                msg.author = "[leader] "+msg.author;
            }
            this.messages.push(msg);
            return true;
        } else {
            return false;
        }
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
    
    ////////////////////////////////////////////////////////////////////////////
    //
    //                              GROUP METHODS
    //
    ////////////////////////////////////////////////////////////////////////////
    
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
       } else {
           socket.emit('err',"Looks like you are already in a group.  Please leave your current group before creating another.");
       }
    });
    //user requested to join a group
    socket.on('reqGroup',function(data){
        if(findGroup(data)!=-1){
            findGroup(data).leader.socket.emit('reqGroup',me.id);
        } else {
            //group could not be found
            socket.emit('err',"Group "+data+" could not be found, sorry about that!");
        }
    });
    //group leader accepted a member
    socket.on('accGroup',function(id){
        if(myGroup!=undefined){
            myGroup.addMember(findUser(id));
            findUser(id).socket.emit('accGroup',me.groupID);
        } else {
            socket.emit('err',"Could not find your group, sorry about that!");
        }
    });
    //group leader declined a member
    socket.on('decGroup',function(id){
        if(myGroup!=undefined){
            findUser(id).socket.emit('decGroup',me.groupID);
        } else {
            socket.emit('err',"Could not find your group, sorry about that!");
        }
    });
    //user giving group info
    socket.on('confirmGroup',function(id){
       me.groupID = id;
       myGroup = findGroup(id);
    });
    
    ////////////////////////////////////////////////////////////////////////////
    //
    //                        DRAWING/CANVAS METHODS
    //
    ////////////////////////////////////////////////////////////////////////////
    
    //user is trying to draw a line
    socket.on('drawLine',function(data){
        if(myGroup!=undefined){
            //limit pen weight
            data.wid = data.wid>MAX_WEIGHT ? MAX_WEIGHT : data.wid;
            data.wid = data.wid<1 ? 1 : data.wid;
            myGroup.emitAll('drawLine',data,me);
        }
    });
    
    //New user needs current canvas
    socket.on('reqCanvas',function(data){
        if(myGroup!=undefined){
            myGroup.leader.socket.emit('reqCanvas',me.id);
        } else {
            socket.emit('err',"Could not find your group's canvas");   
        }
    });
    
    //Group leader sent current canvas
    socket.on('sendCanvas',function(data){
       if(myGroup!=undefined){
            var intendedUser = findUser(data.user);
            if(myGroup.checkMember(intendedUser)){
                intendedUser.socket.emit('recieveCanvas',data.dataURL);
            }
       } 
    });
    
    ////////////////////////////////////////////////////////////////////////////
    //
    //                        CHAT/MESSAGING METHODS
    //
    ////////////////////////////////////////////////////////////////////////////
    
    //user sent message to the rest of the group
    socket.on('sendMsg',function(msg){
       if(myGroup!=undefined){
            if(msg.length<=MAX_CHARS){
                if(myGroup.addMessage((new message("Anonymous",msg)),me)) { //TODO: Make names
                    myGroup.emitAll('recieveMsg',myGroup.messages[myGroup.messages.length-1],me);
                    socket.emit('recieveMsg',myGroup.messages[myGroup.messages.length-1]);  //Send message to self so we can verify it sent properly
                }
            } else {
                socket.emit('err','Message length longer than limit of ' + MAX_CHARS + ' characters, sorry about that!');   
            }
       } else {
           socket.emit('err',"Could not find your group, sorry about that!");
       }
    });
    
    //user joined group and requested all of the past messages
    socket.on('getMessages',function(data){
        if(myGroup!=undefined){
            if(myGroup.checkMember(me)){
                socket.emit('recieveMessages',myGroup.messages);
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
