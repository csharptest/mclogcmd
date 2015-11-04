'use strict';
var childProcess = require('child_process');
var fs = require('fs');
var Path = require('path');
var timers = require('timers');
var extend = require('util')._extend;

function copyFile(source, target, cb) {
    var cbCalled = false;

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

var config = {
    minecraft: {
        log: '/opt/msm/servers/survival/logs/latest.log',
        playerList: '/opt/msm/servers/survival/whitelist.json',
        playerData: '/opt/msm/servers/survival/world/playerdata/',
        playerBackup: '/opt/msm/servers/survival/playerStore/',
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
                }

                var args = ['survival', 'save', 'all'];
                var players = {};
                JSON.parse(fs.readFileSync(config.minecraft.playerList))
                    .forEach(function(p) { players[p.name.toLowerCase()] = p.uuid; });
                var uuid = players[data.username.toLowerCase()];
                var pthData = Path.join(config.minecraft.playerData, (uuid || '') + '.dat');
                if (!uuid || !fs.existsSync(pthData)) {
                    return fail('Unable to locate player data.');
                }
                var pthBack = Path.join(config.minecraft.playerBackup, uuid + '.dat');
                if (fs.existsSync(pthBack)) {
                    return fail('You are already in creative.');
                }

                console.log('> ' + config.mcexec.file + ' ' + args.join(' '));
                childProcess.execFile(config.mcexec.file, args, {
                        cwd: __dirname,
                        timeout: 60000
                    }, function (err, stdOut, stdErr) {
                    if (err) {
                        console.log(err.message);
                        //return fail('Unable to save the world.');
                    }
                    if (stdErr.length) {
                        console.log('! ' + stdErr.toString());
                    }
                    if (stdOut.length) {
                        console.log('< ' + stdOut.toString());
                    }

                    copyFile(pthData, pthBack, function (ecopy) {
                        if (ecopy) {
                            return fail('Unable to create backup.');
                        }

                        mcrun('/tp @p 143 60 5083');
                        complete();
                    });
                });
            }
        }
    }
};

module.exports = config;
