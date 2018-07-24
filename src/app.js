require('dotenv').config()

var debug = require('debug')('howdoi-bot');

var Discord = require('discord.js');
var async = require('async');

const client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

var commands = require('./commands')(client);
var getYAResponse = require('./getYAResponse');

function getResponses(paragraphs, chunkLength) {
    var responses = [];
    while (paragraphs.length) {
        if (!responses.length) {
            responses.push('');
        }
        //1 extra character, because of newline
        if (responses[responses.length-1].length + paragraphs[0].length < chunkLength) {
            //Entire paragraph can fit 
            responses[responses.length-1] += paragraphs[0] + '\n';
            paragraphs.shift();
        } else {
            //Split paragraph into words (the whole thing will not fit)
            paragraphs[0] = paragraphs[0].trim().split(' ');    
            //Pack words in until you reach 2k characters
            while (
                responses[responses.length-1].length + paragraphs[0][0].length < chunkLength
            ) {
                responses[responses.length-1] += ' ' + paragraphs[0].shift();
            }

            //Re-combine the rest of the paragraph, so that it can be put in the next response
            paragraphs[0] = ' ' + paragraphs[0].join(' ');
            responses.push('');
        } 
    }

    return responses;
}

client.on('ready', function() {
    debug('Logged in as "%s" (%s)\n', client.user.username, client.user.id);
});

client.on('message', function(message) {
    if (message.author.userId !== client.user.id && message.content.substring(2, 20) == client.user.id) {
        messageText = message.content.substring(22).trim().toLowerCase();
        
        if (messageText in commands) {
            return message.channel.send(commands[messageText], {
                tts: true
            }).catch(function(err) {
                debug(err);
            });
        }

        getYAResponse(messageText, function(err, response) {
            if (err) {
                return debug(err);
            }

            if (response.length <= 2000) {
                return message.channel.send(response).catch(function(err) {
                    debug(err);
                });
            }

            var paragraphs = response.split('\n')
            var responses = getResponses(paragraphs, 2000);
            async.eachSeries(responses, function(msg, callback) {
                message.channel.send(msg).catch(function(err) {
                    return debug(err);
                }).then(function() {
                    callback();
                });
            });
        });
    }
});
