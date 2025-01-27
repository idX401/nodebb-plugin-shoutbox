'use strict';

const packageInfo = require('../package.json');
const pluginInfo = require('../plugin.json');

const pluginId = pluginInfo.id.replace('nodebb-plugin-', '');
const NodeBB = require('./nodebb');

const Config = module.exports;

const features = [
	{
		name: 'Gists',
		id: 'gist',
		description: 'Easily create Gists',
		icon: 'fa-github-alt',
		button: 'Create Gist',
		enabled: true,
	},
	{
		name: 'Bugs',
		id: 'bug',
		description: 'Report bugs quickly',
		icon: 'fa-bug',
		button: 'Report Bug',
		enabled: false,
	},
];

const adminDefaults = {
	toggles: {
		guestsAllowed: false,
		headerLink: false,
		features: (function () {
			const defaults = {};
			features.forEach((el) => {
				defaults[el.id] = el.enabled;
			});

			return defaults;
		}()),
	},
	limits: {
		shoutLimit: '25',
	},
	version: '',
};

const userDefaults = {
	'toggles:sound': 0,
	'toggles:notification': 1,
	'toggles:hide': 0,
	muted: '',
};

Config.plugin = {
	name: pluginInfo.name,
	id: pluginId,
	version: packageInfo.version,
	description: packageInfo.description,
	icon: 'fa-bullhorn',
};

Config.init = function (callback) {
	Config.global = new NodeBB.Settings(Config.plugin.id, Config.plugin.version, adminDefaults, () => {
		callback();
	});
};

Config.global = {};

Config.adminSockets = {
	sync: function () {
		Config.global.sync();
	},
	getDefaults: function (socket, data, callback) {
		callback(null, Config.global.createDefaultWrapper());
	},
};

Config.user = {};
Config.user.sockets = {};

Config.user.get = async function (data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!Config.global.get) {
		return data;
	}
	const prefix = `${Config.plugin.id}:`;
	if (!data.settings) {
		data.settings = {};
	}

	Object.keys(userDefaults).forEach((key) => {
		const fullKey = prefix + key;
		data.settings[fullKey] = data.settings.hasOwnProperty(fullKey) ? data.settings[fullKey] : userDefaults[key];
	});

	data.settings['shoutbox:shoutLimit'] = parseInt(Config.global.get('limits.shoutLimit'), 10);
	return data;
};

// get user shoutbox settings
Config.user.load = async function (uid) {
	const settings = await NodeBB.User.getSettings(uid);
	const sbSettings = {};
	const prefix = `${Config.plugin.id}:`;
	Object.keys(userDefaults).forEach((key) => {
		const fullKey = prefix + key;
		sbSettings[fullKey] = settings.hasOwnProperty(fullKey) ? settings[fullKey] : userDefaults[key];
	});
	sbSettings['shoutbox:shoutLimit'] = parseInt(Config.global.get('limits.shoutLimit'), 10);
	return sbSettings;
};

Config.user.save = async function (hookData) {
	if (!hookData || !hookData.uid || !hookData.settings) {
		throw new Error('[[error:invalid-data]]');
	}

	Object.keys(userDefaults).forEach((key) => {
		const fullKey = `${Config.plugin.id}:${key}`;
		if (hookData.data.hasOwnProperty(fullKey)) {
			hookData.settings[fullKey] = hookData.data[fullKey];
		}
	});
	return hookData;
};

Config.user.sockets.getSettings = async function (socket) {
	if (!socket.uid) {
		throw new Error('not-logged-in');
	}
	return {
		settings: await Config.user.load(socket.uid),
	};
};

Config.user.sockets.saveSettings = async function (socket, data) {
	if (!socket.uid || !data || !data.settings) {
		throw new Error('[[error:invalid-data]]');
	}

	data.uid = socket.uid;
	await NodeBB.api.users.updateSettings(socket, data);
};

Config.getTemplateData = function () {
	const featureConfig = Config.global.get('toggles.features');
	const data = {};

	data.features = features.slice(0).map((item) => {
		item.enabled = featureConfig[item.id];
		return item;
	});

	return data;
};
