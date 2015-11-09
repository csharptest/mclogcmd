'use strict';
/**
 * Created by rogerk on 11/8/15.
 * Reads a script file and optionally applies transforms
 */
/* eslint camelcase: 0 */
var fs = require('fs');
var Path = require('path');

var cmdFormat = /^(\/\w+)([ \t]+(~-?\d{0,2})[ \t]+(~-?\d{0,2})[ \t]+(~-?\d{0,2}))?([ \t]+(~-?\d{0,2})[ \t]+(~-?\d{0,2})[ \t]+(~-?\d{0,2}))?([ \t]+([\w\-_:]+)([ \t]+(\d{1,2}))?)?([ \t]+([^'"$]*?))?(?=[ \t]*$)/i;

function toNumber(txt) {
    return (!txt || txt.length === 0 || txt === '~') ? 0
        : parseInt((txt[0] === '~') ? txt.substr(1) : txt);
}

function McCommand(m) {
    this.command = m[1];
    var ix = 2;
    if (m[ix++]) {
        this.pt1 = { x: toNumber(m[ix++]), y: toNumber(m[ix++]), z: toNumber(m[ix++]) };
    }
    else { ix += 3; }

    if (m[ix++]) {
        this.pt2 = { x: toNumber(m[ix++]), y: toNumber(m[ix++]), z: toNumber(m[ix++]) };
    }
    else { ix += 3; }

    if (m[ix++]) {
        this.block = m[ix++];
        if (m[ix++]) {
            this.dvalue = toNumber(m[ix++] || '0');
        }
        else { ix += 1; }
    }
    else { ix += 3; }

    if (m[ix++]) {
        this.extra = m[ix++];
    }
    else { ix += 1; }
    if (ix !== 16) {
        throw new Error('Missing increment: ' + ix);
    }
}

McCommand.prototype.toString = function() {
    var txt = this.command;
    if (this.pt1) {
        txt += ' ~' + this.pt1.x + ' ~' + this.pt1.y + ' ~' + this.pt1.z;
        if (this.pt2) {
            txt += ' ~' + this.pt2.x + ' ~' + this.pt2.y + ' ~' + this.pt2.z;
        }
    }
    if (this.block) {
        txt += ' ' + this.block;
        if (this.dvalue) {
            txt += ' ' + this.dvalue;
        }
    }
    if (this.extra) {
        txt += ' ' + this.extra;
    }
    return txt;
};

function parseScript(scriptText) {
    var list = scriptText.split('\n');
    var arr = [];
    for (var ix = 0; ix < list.length; ix++) {
        //Each command line must match
        var cmd = list[ix].match(cmdFormat);
        if (cmd) {
            arr.push(new McCommand(cmd));
        }
    }
    return arr;
}

function xFormWood(name, id, cmd) {
    cmd.dvalue = cmd.dvalue || 0;
    if (cmd.block === 'planks' && cmd.dvalue === 0) {
        cmd.dvalue = id;
    }
    else if (cmd.block === 'log' && cmd.dvalue === 0) {
        if (id <= 3) {
            cmd.dvalue = id + (cmd.dvalue & 0xC);
        }
        else {
            cmd.block = 'log2';
            cmd.dvalue = id - 4 + (cmd.dvalue & 0xC);
        }
    }
    else if (cmd.block === 'double_wooden_slab' && cmd.dvalue === 0) {
        cmd.dvalue = id;
    }
    else if (cmd.block === 'double_wooden_slab' && cmd.dvalue === 0) {
        cmd.dvalue = id;
    }
    else if (cmd.block === 'wooden_slab' && (cmd.dvalue === 0 || cmd.dvalue === 8)) {
        cmd.dvalue += id;
    }
    else if (cmd.block === 'wooden_door') {
        cmd.block = name + '_door';
    }
    else if (cmd.block === 'oak_stairs') {
        cmd.block = name + '_stairs';
    }
    else if (cmd.block === 'fence') {
        cmd.block = name + '_fence';
    }
    else if (cmd.block === 'fence_gate') {
        cmd.block = name + '_fence_gate';
    }
    return cmd;
}

function xFormBrick(name, id, cmd) {
    if (cmd.block === 'cobblestone') {
        cmd.block = name;
        if (name === 'quartz' || name === 'brick') {
            cmd.block += '_block';
        } else if (name === 'stone_brick') {
            cmd.block = 'stonebrick';
        }
    }
    else if (cmd.block === 'stone_stairs') {
        cmd.block = name + '_stairs';
    }
    else if (cmd.block === 'double_stone_slab' && cmd.dvalue === 3) {
        cmd.dvalue = id;
    }
    else if (cmd.block === 'stone_slab' && cmd.dvalue === 3) {
        cmd.dvalue = id;
    }
    return cmd;
}

function flipX(cmd) {
    if (cmd.pt1) {
        cmd.pt1.x = -cmd.pt1.x;
    }
    if (cmd.pt2) {
        cmd.pt2.x = -cmd.pt2.x;
    }
    if (cmd.block === 'furnace' || cmd.block === 'ladder' || cmd.block === 'chest') {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 5 ? 4 : cmd.dvalue === 4 ? 5 : cmd.dvalue;
    }
    else if (cmd.block.match(/stairs$/)) {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 0 ? 1 : cmd.dvalue === 1 ? 0 : cmd.dvalue;
    }
    else if (cmd.block.match(/door$/)) {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 0 ? 2 : cmd.dvalue === 2 ? 0 : cmd.dvalue;
    }
    else if (cmd.block === 'torch') {
        cmd.dvalue = cmd.dvalue === 1 ? 2 : cmd.dvalue === 2 ? 1 : cmd.dvalue;
    }
    return cmd;
}

function flipZ(cmd) {
    if (cmd.pt1) {
        cmd.pt1.z = -cmd.pt1.z;
    }
    if (cmd.pt2) {
        cmd.pt2.z = -cmd.pt2.z;
    }
    if (cmd.block === 'furnace' || cmd.block === 'ladder' || cmd.block === 'chest') {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 3 ? 2 : cmd.dvalue <= 2 ? 3 : cmd.dvalue;
    }
    else if (cmd.block.match(/stairs$/)) {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 2 ? 3 : cmd.dvalue === 3 ? 2 : cmd.dvalue;
    }
    else if (cmd.block.match(/door$/)) {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 1 ? 3 : cmd.dvalue === 3 ? 1 : cmd.dvalue;
    }
    else if (cmd.block === 'torch') {
        cmd.dvalue = cmd.dvalue === 3 ? 4 : cmd.dvalue === 4 ? 3 : cmd.dvalue;
    }
    return cmd;
}

function swapXz(cmd) {
    var tmp;
    if (cmd.pt1) {
        tmp = cmd.pt1.z;
        cmd.pt1.z = cmd.pt1.x;
        cmd.pt1.x = tmp;
    }
    if (cmd.pt2) {
        tmp = cmd.pt2.z;
        cmd.pt2.z = cmd.pt2.x;
        cmd.pt2.x = tmp;
    }
    if (cmd.block === 'furnace' || cmd.block === 'ladder' || cmd.block === 'chest') {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue <= 2 ? 4
            : cmd.dvalue === 3 ? 5
            : cmd.dvalue === 4 ? 2
            : cmd.dvalue === 5 ? 3
            : cmd.dvalue;
    }
    else if (cmd.block.match(/stairs$/)) {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = cmd.dvalue === 0 ? 2
            : cmd.dvalue === 2 ? 0
            : cmd.dvalue === 1 ? 3
            : cmd.dvalue === 3 ? 1
            : cmd.dvalue;
    }
    else if (cmd.block.match(/door$/) && (!cmd.dvalue || cmd.dvalue < 8)) {
        cmd.dvalue = cmd.dvalue || 0;
        cmd.dvalue = ((cmd.dvalue & 3) + 1) | (cmd.dvalue & ~3);
    }
    else if (cmd.block === 'torch') {
        cmd.dvalue = cmd.dvalue === 1 ? 3
            : cmd.dvalue === 2 ? 4
            : cmd.dvalue === 3 ? 1
            : cmd.dvalue === 4 ? 2
            : cmd.dvalue;
    }
    return cmd;
}

function BuildScript(text) {
    this.transforms = [];
    this.script = parseScript(text);
}

BuildScript.prototype.addTransform = function(fn) {
    this.transforms.push(fn);
};

BuildScript.prototype.Transforms = {
    /** @param {McCommand} cmd */
    flipx: flipX,
    flipz: flipZ,
    swapxz: swapXz,
    sink: function(cmd) {
        if (cmd.block && cmd.block.match(/stairs$/) && cmd.pt1 && cmd.pt1.y === 0) {
            delete cmd.command;
            cmd.block = 'no-op';
            return cmd;
        }
        if (cmd.pt1) { cmd.pt1.y -= 1; }
        if (cmd.pt2) { cmd.pt2.y -= 1; }
        return cmd;
    },
    // templates are defined in oak: xformWood.bind(null, 'oak', 0),
    spruce: xFormWood.bind(null, 'spruce', 1),
    birch: xFormWood.bind(null, 'birch', 2),
    jungle: xFormWood.bind(null, 'jungle', 3),
    acacia: xFormWood.bind(null, 'acacia', 4),
    dark_oak: xFormWood.bind(null, 'dark_oak', 5),
    // templates are defined in cobblestone: xFormBrick( null, 'cobblestone', 3),
    sandstone: xFormBrick.bind(null, 'sandstone', 1),
    brick: xFormBrick.bind(null, 'brick', 4),
    stone_brick: xFormBrick.bind(null, 'stone_brick', 5),
    nether_brick: xFormBrick.bind(null, 'nether_brick', 6),
    quartz: xFormBrick.bind(null, 'quartz', 7)
};

BuildScript.prototype.apply = function(exec) {
    var self = this;
    self.script.forEach(function(cmd) {
        self.transforms.forEach(function(xform) {
            if (cmd.command) {
                cmd = xform(cmd);
            }
        });
        exec(cmd.toString());
    });
};

module.exports = BuildScript;
