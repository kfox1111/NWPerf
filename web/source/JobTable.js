enyo.kind({
        name: "JobTable",
	kind: "FittableRows",
	classes: "enyo-selectable JobTable",
	published: {
		jobs: [],
		showUsers: false
	},
	events: {
		onJobSelected: ""
	},
        components:[
		{name: "spinnerPopup", kind: "onyx.Popup", centered: true, floating: true, components: [
			{kind: "onyx.Spinner"}
		]},
		{kind: "FittableColumns", classes: "JobTable-header-container", components: [
			{classes: "JobTable-header", style: "width: 9%", ontap: "sortColumn", content: "Job ID", name: "idHeader"},
			{classes: "JobTable-header", style: "width: 9%", ontap: "sortColumn", content: "Account", name: "accountHeader"},
			{classes: "JobTable-header", style: "width: 9%", ontap: "sortColumn", showing: false, content: "User", name: "userHeader"},
			{classes: "JobTable-header", style: "width: 16%", ontap: "sortColumn", content: "Submit Time", name: "submittimeHeader"},
			{classes: "JobTable-header", style: "width: 16%", ontap: "sortColumn", content: "Start Time", name: "starttimeHeader"},
			{classes: "JobTable-header", style: "width: 16%", ontap: "sortColumn", content: "End Time", name: "endtimeHeader"},
			{classes: "JobTable-header", style: "width: 11%", ontap: "sortColumn", content: "Run Time", name: "runtimeHeader"},
			{classes: "JobTable-header", style: "width: 14%", ontap: "sortColumn", content: "Node Count", name: "numnodesHeader"}
		]},
		{kind: "List", fit: true, name: "jobList", onSetupItem: "addJob", toggleSelected: true, components: [
			{kind: "FittableColumns", classes: "JobTable-row", ontap: "jobTap", components: [
				{classes: "JobTable-cell", style: "width: 9%;", name: "jobId"},
				{classes: "JobTable-cell", style: "width: 9%;", name: "account"},
				{classes: "JobTable-cell", style: "width: 9%;", name: "user", showing: false},
				{classes: "JobTable-cell", style: "width: 16%;", name: "submitTime"},
				{classes: "JobTable-cell", style: "width: 16%;", name: "startTime"},
				{classes: "JobTable-cell", style: "width: 16%;", name: "endTime"},
				{classes: "JobTable-cell", style: "width: 11%; text-align: right;", name: "runTime"},
				{classes: "JobTable-cell", style: "width: 14%; text-align: right;", name: "nodes"}
			]}
		]}
        ],
	spin: function() {
		this.$.spinnerPopup.show();
	},
	curSortedColumn: null,
	curSortedOrder: null,
	sortColumn: function(inSender, inEvent) {
		if(this.curSortedColumn == inSender) {
			if(this.curSortedOrder == "desc") {
				this.curSortedColumn.setClasses("JobTable-header-asc");
				this.curSortedOrder = "asc";
			} else {
				this.curSortedColumn.setClasses("JobTable-header-desc");
				this.curSortedOrder = "desc";
			}
		} else {
			if(this.curSortedColumn) {
				this.curSortedColumn.setClasses("JobTable-header");
			}
			this.curSortedColumn = inSender;
			this.curSortedOrder = "asc";
			this.curSortedColumn.setClasses("JobTable-header-asc");
		}
		var field = inSender.name.replace("Header", "");
		if(field == "numnodes" || field == "id") {
			if(this.curSortedOrder == "asc") {
				var sortFunc = function(a,b) { return parseInt(a[field]) - parseInt(b[field]); }
			} else {
				var sortFunc = function(a,b) { return parseInt(b[field]) - parseInt(a[field]); }
			}
		} else {
			if(this.curSortedOrder == "asc") {
				var sortFunc = function(a,b) {
					if(a[field] == null)
						a[field] = "";
					if(b[field] == null) 
						b[field] = "";
						
					return a[field].localeCompare(b[field]);
				}
			} else {
				var sortFunc = function(a,b) {
					if(a[field] == null)
						a[field] = "";
					if(b[field] == null) 
						b[field] = "";
						
					return b[field].localeCompare(a[field]);
				}
			}
		}
		this.jobs.sort(sortFunc);
		this.$.spinnerPopup.hide();
		this.$.jobList.setCount(this.jobs.length);
		this.$.jobList.refresh();
	},
	jobsChanged: function(oldValue) {
		if(this.curSortedColumn != null) 
			this.curSortedColumn.setClasses("JobTable-header");
		this.curSortedColumn = null;
		this.curSortedOrdered = null;
		this.sortColumn(this.$.idHeader);
	},
	showUsersChanged: function(oldValue) {
		this.$.userHeader.setShowing(this.showUsers);
		this.$.jobList.refresh();
	},
	addJob: function(inSender, inEvent) {
		var job = this.jobs[inEvent.index];
		this.$.user.setContent(job.user);
		this.$.user.setShowing(this.showUsers);
		this.$.jobId.setContent(job.id);
		this.$.account.setContent(job.account);
		this.$.nodes.setContent(job.numHosts);
		this.$.submitTime.setContent(job.submitTime);
		this.$.startTime.setContent(job.startTime);
		this.$.endTime.setContent(job.endTime);
		this.$.runTime.setContent(job.runTime);
	},

	jobTap: function(inSender, inEvent) {
		this.doJobSelected(this.jobs[inEvent.index]);
	}
});
