var debug = require('debug')('howdoi-bot:send-ya-response');

var async = require('async');
var google = require('google');
var jsdom = require('jsdom');
const { JSDOM } = jsdom;
var turndownservice = require('turndown')();
var Promise = require('promise');

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function getQuestionLinks(params) {
    return new Promise(function(resolve, reject) {
        debug('Getting question links for query...');

        var input = params.input;

        google('how do I ' + input + ' site:answers.yahoo.com/question', function(err, res) {
            debug('Done.');

            if (err) {
                reject(err);
            } else {
                if (res.links.length > 0) {
                    var hrefs = res.links.map(function(link) {
                        return link.href;
                    });
                    resolve({ links: hrefs });
                } else {
                    resolve({ text: 'Beep boop, no results found.' });
                }
            }
        });
    });
}

function getYAResponse(params) {
    return new Promise(function(resolve, reject) {
        var links = params.links;
        if (links[0] == null) {
            links.shift();
        }
        links = shuffleArray(links.slice(0, 3));
        debug(links);

        if (!links) {
            resolve(params);
        } else {
            async.eachSeries(links, function(link, callback) {
                debug('Checking ' + link + ' for answer...');
                if (!link) {
                    callback();
                }

                JSDOM.fromURL(link).then(function(dom) {
                    var results = dom.window.document.getElementsByClassName('ya-q-full-text');
                    var title = dom.window.document.getElementsByClassName('Fz-24')[0];
                    var hasEllipses = dom.window.document.querySelectorAll('.Fz-13.Fw-n.Mb-10 .ya-q-full-text').length;
                    var question = title.textContent.trim();
                    debug('title: ' + question)

                    if (results && hasEllipses && results.length >= 2) {
                        var topResult = results[1].innerHTML;
                    } else if (results && !hasEllipses && results.length >= 1) {
                        var topResult = results[0].innerHTML;
                    }

                    return resolve({ question: question, text: turndownservice.turndown(topResult.replace(/([*\~_\\])/g, '\\$1')), source: link });
                }).catch(function(err) {
                    debug(err);
                    callback();
                });
            }, function() {
                debug('No results found.');

                resolve({ text: 'Beep boop, no results found.' });
            });
        }
    });
}

module.exports = function(input, end) {
    getQuestionLinks({ input: input })
        .then(getYAResponse)
        .then(function(res) {
            if (res.question) {
                return end(null, '*Your question is: "' + res.question + '*\nYour answer is:\n' + res.text + '\n*Source: ' + res.source + '*');
            }
            return end(null, res.text);
        })
        .catch(function(err) {
             return end(err);
        });
};
