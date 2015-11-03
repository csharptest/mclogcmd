module.exports = {
    minecraft: {
        log: '/opt/msm/servers/survival/logs/latest.log',
        cwd: '.',
        timeout: 10000,
        execFile: '/usr/local/bin/msm',
        execArgs: 'survival cmd execute @p[name={username},x=-2000,y=64,z=-250,r=2000] ~ ~ ~ {command}',
        logFormat: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: <(\w+)> #(\/.*)/i
    },
    commands: [
        { match: /^\/tp @p ~|\d/i },
        { match: /^\/fill /i },
        { match: /^\/clone /i },
        { match: /^\/blockdata /i },
        { match: /^\/setblock /i },
        { match: /^\/summon /i },
        { match: /^\/weather /i },
        { match: /^\/me /i }
    ]
};
