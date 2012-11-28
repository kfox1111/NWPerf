enyo.kind({
	name: "JobView",
	kind: "FittableRows",
	classes: "JobView",
	published: {
		job: false
	},
	events: {
		onJobViewClosed: ""
	},
	components:[
		{kind: "FittableColumns", fit: true, components: [
			{kind: "Scroller", fit: true, components: [
				{name: "spinnerPopup", kind: "onyx.Popup", centered: true, floating: true, components: [
					{kind: "onyx.Spinner"}
				]},
				{name: "jobGraphs"}
			]},
			{kind: "FittableRows", name: "legendView", components: [
				{kind: "FittableColumns", classes: "legend-aggregate", name: "averageDisplay", content: "Average: "},
				{kind: "FittableColumns", classes: "legend-aggregate", name: "sumDisplay", content: "Sum: "},
				{kind: "FittableColumns", components: [
					{components: [
						{kind: "Checkbox", onActivate: "toggleCheckboxes", active: true}
					]},
					{content: "Select All"}
				]},
				{kind: "Scroller", classes: "legend", fit: true, components: [
					{kind: "Repeater", name: "legend", onSetupItem: "legendItem", components: [
						{kind: "FittableColumns", components: [
							{components: [
								{name: "enable", kind: "Checkbox", onActivate: "legendChecked", host: ""}
							]},
							{classes: "color-border", components: [
								{name: "color"}
							]},
							{name: "label", classes: "legend-label"},
							{name: "value", classes: "legend-label"}
						]}
					]}
				]}
			]}
		]},
		{kind: "onyx.Toolbar", components: [
			{kind: "onyx.Button", ontap: "doJobViewClosed", content: "Close"},
			{kind: "onyx.Button", show: false, name: "cviewButton", ontap: "downloadCview", content: "Download Cview"}
		]},
	],
	downloadCview: function(inSender, inEvent) {
		window.location.href = this.job.cview;
	},
	toggleCheckboxes: function(inSender, inEvent) {
		this.legendUpdatesEnabled = false;
		for(i=0;i<this.legend.length;i++) {
			this.legend[i].enabled = inSender.checked;
		}
		for(i=0;i<this.graphs.length;i++) {
			this.graphs[i].setLegend(this.legend.slice(0));
		}
		this.$.legend.setCount(this.legend.length);
		this.legendUpdatesEnabled = true;
	},
	legendUpdatesEnabled: true,
	legendChecked: function(inSender, inEvent) {
		if(this.legendUpdatesEnabled) {
			for(i=0;i<this.legend.length;i++) {
				if(this.legend[i].host == inSender.host) {
					this.legend[i].enabled = inSender.checked;
					break;
				}
			}
			this.values[inSender.host].setContent("");
			this.updateLegendValues()
			for(i=0;i<this.graphs.length;i++) {
				this.graphs[i].setLegend(this.legend.slice(0));
			}
		}
	},
	values: {},
	hsl2rgb: function(h, s, l){
		var r, g, b;

		if(s == 0){
			r = g = b = l; // achromatic
		}else{
			function hue2rgb(p, q, t){
				if(t < 0) t += 1;
				if(t > 1) t -= 1;
				if(t < 1/6) return p + (q - p) * 6 * t;
				if(t < 1/2) return q;
				if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
				return p;
			}
			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = hue2rgb(p, q, h + 1/3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1/3);
		}
		return [r * 255, g * 255, b * 255];
	},
	legendItem: function(inSender, inEvent) {
		inEvent.item.$.enable.checked = this.legend[inEvent.index].enabled;
		inEvent.item.$.enable.host = this.legend[inEvent.index].host
		color = this.legend[inEvent.index].color;
		color = this.hsl2rgb(color[0]/360.0, color[1], color[2]);
		inEvent.item.$.color.setStyle("border: 5px solid rgb("+Math.round(color[0])+", "+Math.round(color[1])+", "+Math.round(color[2])+");");
		inEvent.item.$.label.setContent(this.legend[inEvent.index].host);
		this.values[this.legend[inEvent.index].host] = inEvent.item.$.value;
		return true;
	},
	updateLegendValues: function(inSender, inEvent) {
		sum = 0;
		count = 0;
		for(host in inEvent) {
			if(host != "originator") {
				this.values[host].setContent(": " + inEvent[host].toPrecision(4));
				sum += inEvent[host];
				count++;
			}
		}
		if(count > 0) {
			this.$.averageDisplay.setContent("Average: " + (sum/count).toPrecision(4));
			this.$.sumDisplay.setContent("Sum: " + sum.toPrecision(4));
		}
	},
	spin: function() {
		this.$.jobGraphs.destroyClientControls();
		this.$.spinnerPopup.show();
	},
	legend: [],
	graphs: [],
	alphaNumericSort: function(a, b) {
		nodeRePair=/([\D]*)([\d]*)/g;
		aPairs = a.match(nodeRePair);
		bPairs = b.match(nodeRePair);
		numLoops = Math.min(aPairs.length, bPairs.length);
		for(i=0;i<numLoops;i++) {
			nodeRePaira=/([\D]*)([\d]*)/g;
			nodeRePairb=/([\D]*)([\d]*)/g;
			aElements = nodeRePaira.exec(aPairs[i]);
			bElements = nodeRePairb.exec(bPairs[i]);
			if(aElements[1] == bElements[1]) {
				diff = parseInt(aElements[2]) - parseInt(bElements[2]);
				if(diff != 0)
					return diff;
			} else {
				return aElements[1] - bElements[1];
			}
		}
		return aElements.length - bElements.length;
	},
	jobChanged: function(oldValue) {
		this.graphs = [];
		this.values = {};
		if(this.job.cview) {
			this.$.cviewButton.setShowing(true);
		} else {
			this.$.cviewButton.setShowing(false);
		}
		numGraphs = 0;
		if(this.job["version"] == 2) {
			this.legend = [];
			numHosts = this.job["hosts"].length;
			hue = hueFractions = 350/numHosts;
			lightnessFractions = .3/numHosts;
			lightness = .3;
			this.job["hosts"].sort(this.alphaNumericSort);
			for(host in this.job["hosts"]) {
				hue += hueFractions;
				lightness += lightnessFractions;
				this.legend[host] = {host: this.job["hosts"][host], color: [hue, 1, lightness], enabled: true};
			}
			this.$.legend.setCount(numHosts);
			this.$.legendView.setShowing(true);
			this.$.jobGraphs.render();
		} else {
			this.$.legendView.setShowing(false);
			this.$.jobGraphs.render();
		}
		for(group in this.job["graphs"]) {
			numGraphs++;
			if(group == "") {
				groupHeader = this.$.jobGraphs.createComponent({content: "other", ontap: "toggleDrawer", classes: "group-header"}, {owner:  this});
			} else {
				groupHeader = this.$.jobGraphs.createComponent({content: group, ontap: "toggleDrawer", classes: "group-header"}, {owner:  this});
			}
			groupDrawer = this.$.jobGraphs.createComponent({kind: "onyx.Drawer", open: false});
			groupHeader.drawer = groupDrawer;
			for(metric in this.job["graphs"][group]) {
				if(this.job["graphs"][group][metric]["unit"] != null)
					unit = " ("+this.job["graphs"][group][metric]["unit"]+")";
				else
					unit = "";
				
				if(this.job["graphs"][group][metric]["description"] != null)
					description = " - " + this.job["graphs"][group][metric]["description"];
				else
					description = "";
				headerText = 	this.job["graphs"][group][metric]["name"]
						+ unit
						+ description;
				metricHeader = groupDrawer.createComponent({content: headerText, ontap: "toggleDrawer", classes: "image-header"}, {owner:  this})
				metricDrawer = groupDrawer.createComponent({kind: "onyx.Drawer", open: false});
				metricHeader.drawer = metricDrawer;
				if(this.job["version"] == 1) {
					metricDrawer.createComponent({kind: "Image", src: this.job["graphs"][group][metric]["src"], ontap: "toggleThumbnail", classes: "thumbnail", thumbnail: true}, {owner: this});
				} else {
					this.graphs.push( metricDrawer.createComponent({kind: "Flot", legend: this.legend, src: this.job["graphs"][group][metric]["src"], classes: "graph", onValuesUpdate: "updateLegendValues"}, {owner: this}));
				}
			}
		}
		if(numGraphs == 0) {
			this.$.jobGraphs.createComponent({content: "Sorry there is no data for this job", classes:"job-error"});
		}
		this.$.spinnerPopup.hide();
		this.$.jobGraphs.render();
	},
	toggleDrawer: function(inSender, inEvent) {
		if(inSender.drawer.getOpen()) {
			inSender.drawer.setOpen(0);
			if(inSender.getClasses().indexOf("group-header") != -1)
				inSender.setClasses("group-header");
		} else {
			components = inSender.drawer.getControls();
			for(comp in components) {
				if(components[comp].kind == "Flot") {
					components[comp].plot();
				}
			}
			if(inSender.getClasses().indexOf("group-header") != -1)
				inSender.setClasses("group-header group-header-act");
			inSender.drawer.setOpen(1);
		}
	},
	toggleThumbnail: function(inSender, inEvent) {
		inSender.thumbnail = !inSender.thumbnail;
		inSender.addRemoveClass("thumbnail", inSender.thumbnail);
	}
});
