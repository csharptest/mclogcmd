'use strict';
var childProcess = require('child_process');
var fs = require('fs');
var Path = require('path');
var timers = require('timers');
var extend = require('util')._extend;

function copyFile(source, target, cb) {
    var cbCalled = false;

    console.log('Copy file %s to %s', source, target);
    var rd = fs.createReadStream(source);
    rd.on("error", function(err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on("error", function(err) {
        done(err);
    });
    wr.on("close", function(ex) {
        done();
    });
    rd.pipe(wr);

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
}

function msm(args, callback) {
    console.log('> /usr/local/bin/msm ' + args.join(' '));
    childProcess.execFile('/usr/local/bin/msm', args, {
        cwd: __dirname,
        timeout: 60000
    }, function (err, stdOut, stdErr) {
        if (err) {
            console.log(err.message);
            return callback(err);
        }
        if (stdErr.length) {
            console.log('! ' + stdErr.toString());
        }
        if (stdOut.length) {
            console.log('< ' + stdOut.toString());
        }

        callback();
    });
}

function playerInfo(username) {

    var gameBase = '/opt/msm/servers/survival/';
    var players = {};
    JSON.parse(fs.readFileSync(gameBase + 'whitelist.json'))
        .forEach(function(p) { players[p.name.toLowerCase()] = p.uuid; });
    var uuid = players[username.toLowerCase()];
    var pthData = Path.join(gameBase + 'world/playerdata/', (uuid || '') + '.dat');
    if (!uuid || !fs.existsSync(pthData)) {
        throw new Error('Unable to locate player data.');
    }
    var pthBack = Path.join(gameBase + 'playerStore/', uuid + '.dat');
    return {
        name: username,
        uuid: uuid,
        dat: pthData,
        bak: pthBack
    };
}

var config = {
    minecraft: {
        log: '/opt/msm/servers/survival/logs/latest.log',
        cwd: '.',
        timeout: 10000,
        logFormat: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: [<\[](\w+)[>\]] #(\/.*)\s*$/i,
        badCommand: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: (Failed to execute '.*') as (\w+)\s*$/i
    },
    mcexec: {
        file: '/usr/local/bin/msm',
        args: ['survival', 'cmd']
    },
    mcrunas: {
        args: ['/execute @p[name={username},x=-2000,y=64,z=-250,r=2000] ~ ~ ~ {command}']
    },
    mctell: {
        args: ['/tell {username} {command}']
    },
    commands: {
        tp: { match: /^\/tp @p ~|\d/i },
        fill: { match: /^\/fill /i },
        clone: { match: /^\/clone /i },
        blockdata: { match: /^\/blockdata /i },
        setblock: { match: /^\/setblock /i },
        summon: { match: /^\/summon /i },
        weather: { match: /^\/weather /i },
        'map-update': {
            match: /^\/map-update/i,
            file: '/opt/msm/scripts/update.sh',
            started: 'Started updating the map.',
            complete: 'Finished updating the map.'
        },
        'gamemode creative': {
            match: /^\/gamemode\s+c(reative)?$/i,
            file: 'gamemode',
            action: function(mcrun, data, complete) {
                mcrun('/tell ' + data.username + ' going to creative!');
                var fail = function(message) {
                    mcrun('/tell ' + data.username + ' ' + (message || 'Something went wrong.'));
                    return complete();
                };

                var player;
                try { player = playerInfo(data.username); }
                catch(ex) { return fail(ex.message); }
                if (fs.existsSync(player.bak)) {
                    return fail('You are already in adventure/creative mode.');
                }

                msm(['survival', 'save', 'all'], function (err) {
                    if (err) {
                        //return fail('Unable to save the world.');
                    }

                    copyFile(player.dat, player.bak, function (ecopy) {
                        if (ecopy) {
                            return fail('Unable to create backup.');
                        }

                        mcrun('/tp ' + data.username + ' 143 60 5083');
                        complete();
                    });
                });
            }
        },
        'gamemode adventure': {
            match: /^\/gamemode\s+a(dventure)?$/i,
            file: 'gamemode',
            action: function(mcrun, data, complete) {
                mcrun('/tell ' + data.username + ' going to adventure!');
                var fail = function(message) {
                    mcrun('/tell ' + data.username + ' ' + (message || 'Something went wrong.'));
                    return complete();
                };

                var player;
                try { player = playerInfo(data.username); }
                catch(ex) { return fail(ex.message); }
                if (fs.existsSync(player.bak)) {
                    return fail('You are already in adventure/creative mode.');
                }

                msm(['survival', 'save', 'all'], function (err) {
                    if (err) {
                        //return fail('Unable to save the world.');
                    }

                    copyFile(player.dat, player.bak, function (ecopy) {
                        if (ecopy) {
                            return fail('Unable to create backup.');
                        }

                        mcrun('/tp ' + data.username + ' 129 60 5083');
                        complete();
                    });
                });
            }
        },
        'gamemode survival': {
            match: /^\/gamemode\s+s(urvival)?$/i,
            file: 'gamemode',
            action: function (mcrun, data, complete) {
                mcrun('/tell ' + data.username + ' going to survival, you will momentarily booted off!');
                var fail = function (message) {
                    mcrun('/tell ' + data.username + ' ' + (message || 'Something went wrong.'));
                    return complete();
                };

                var player;
                try {
                    player = playerInfo(data.username);
                }
                catch (ex) {
                    return fail(ex.message);
                }
                if (!fs.existsSync(player.bak)) {
                    return fail('You are already in survival.');
                }

                msm(['survival', 'kick', data.username], function () {
                    msm(['survival', 'bl', 'player', 'add', data.username], function () {
                        msm(['survival', 'save', 'all'], function () {
                            copyFile(player.bak, player.dat, function (ecopy) {
                                if (!ecopy) {
                                    fs.unlink(player.bak, function(erm) {
                                        if (erm) { console.error(erm); }
                                    });
                                }
                                msm(['survival', 'bl', 'player', 'remove', data.username], function () {
                                    if (ecopy) {
                                        return fail('Unable to create backup.');
                                    }
                                    complete();
                                });
                            });
                        });
                    });
                });
            }
        }
    }
};

module.exports = config;
