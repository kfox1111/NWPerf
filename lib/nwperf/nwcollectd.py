# -*- coding: latin-1 -*-
#
import collectd
from nwperf import nnslib
from nwperf import Settings
import zmq
import time
import threading
import multiprocessing
import Queue
import json
import os
try:
        HIGHWATER=zmq.HWM
except AttributeError:
        HIGHWATER=zmq.SNDHWM


class PublishThread(threading.Thread):
	def __init__(self,socket,ns,q):
		threading.Thread.__init__(self)
		self.socket=socket	
		self.ns=ns
		self.q = q
		self.die = False

	def terminate(self):
		self.die = True

	def run(self):
		resettime=time.time()+300
		while not self.die:
			try:
				dp = self.q.get_nowait()
				self.socket.send_multipart(["Point", dp])
			except Queue.Empty:
				if time.time()>resettime:
					resettime=time.time()+300
					self.ns.updateServices()
				time.sleep(5)


class NWCollectd:
	def __init__(self,typeinfo):
		self.nameserver="unknown"
		self.cluster="none"
		self.ns=None
		self.ip="0.0.0.0"
		self.publishTimeout=600
		self.q = multiprocessing.Queue()
		self.qthread = None
		self.typesdb = "/usr/share/collectd/types.db"
		self.types = {}
		self.typeinfo = typeinfo
		self.cachedValues = {}
	
		collectd.register_config(self.config)
		collectd.register_init(self.init)
		collectd.register_write(self.write)
		collectd.register_shutdown(self.shutdown)

	def convertValue(self, host, name, value, time, type):
		# this code was ported directly from collectd. This should be exposed
		# to python instead.
				
		if type == None:
			type = {"ds-type": "GAUGE", "min": float("-inf"), "max": float("inf"), "ds-name": "unknown"}

		key = "%s-%s" % (host, name)
		convertedValue = None
		try:
			prevValue = self.cachedValues[key]
		except KeyError:
			self.cachedValues[key] = {"value": value, "time": time}
			if type["ds-type"] in ["COUNTER", "DERIVE", "ABSOLUTE"]:
				return None
			else:
				convertedValue = value
		else:
			if type["ds-type"] == "COUNTER":
				# why doesn't this use the type.db's min/max?
				
				# check if the COUNTER has wrapped around
				if value < prevValue["value"]:
					if prevValue["value"] <= 4294967295:
						wrap = 4294967295
					else:
						wrap = 18446744073709551615
					diff = wrap - prevValue["value"] + value
				else: # COUNTER has NOT wrapped around
					diff = value - prevValue["value"]

				self.cachedValues[key] = {"value": value, "time": time}
				try:
	  				convertedValue = diff / (time - prevValue["time"])
				except ZeroDivisionError:
					return None
			elif type["ds-type"] == "DERIVE":
				self.cachedValues[key] = {"value": value, "time": time}
				try:
	  				convertedValue = (value - prevValue["value"]) / (time - prevValue["time"])
				except ZeroDivisionError:
					return None
			elif type["ds-type"] == "ABSOLUTE":
				self.cachedValues[key] = {"value": value, "time": time}
				try:
					convertedValue = value / (time - prevValue["time"])
				except ZeroDivisionError:
					return None
			else:
				self.cachedValues[key] = {"value": value, "time": time}
				convertedValue = value 
		if convertedValue < value["min"]:
			convertedValue = value["min"]
		elif convertedValue > value["max"]:
			convertedValue = value["max"]
		return convertedValue

	def config(self,conf):
		if conf.values[0]=="nwcollectd":
			for i in conf.children:
				if i.key == "NameServer":
					self.nameserver=i.values[0]
				if i.key == "ClusterName":
					self.cluster = i.values[0]
				if i.key == "IP":
					self.ip = i.values[0]
				if i.key == "TypesDB":
					self.typesdb = i.values[0]

	def init(self):
		self.ns = nnslib.NameServer(self.nameserver)
		self.socket = zmq.Context().socket(zmq.PUB)
		self.socket.setsockopt(HIGHWATER, 20000000)
		port = self.socket.bind_to_random_port("tcp://%s" %self.ip)
		try:
			self.ns.publishService(self.cluster+".allpoints", "tcp://%s:%s" % (self.ip, port), self.publishTimeout, "pub/sub", "Point")
			self.resettime = time.time()+300
		except nnslib.NameServerException, e:
			collectd.error("Error",e)
		self.qthread = PublishThread(self.socket,self.ns,self.q)
		self.qthread.setDaemon(True)
		self.qthread.start()
		self.parsetypes()

	def parsetypes(self):
		for i in open(self.typesdb):
			if i.startswith("#") or i.strip() == "":
				continue
			i = i.strip().split()
			for val in i[1:]:
				val = val.strip(",").split(":")
				if val[2] == "U":
					val[2] = "-inf"
				if val[3] == "U":
					val[3] = "inf"
				for j in range(2, 4):
					val[j] = float(val[j])
				self.types.setdefault(i[0], []).append({
					"ds-name": val[0],
					"ds-type": val[1],
					"min": val[2],
					"max": val[3]
				})
		
	def write(self,vl, data=None):
		for (i, val) in enumerate(vl.values):
			if vl.type_instance != "":
				type_instance = vl.type_instance
			else:
				try:
					type_instance = self.types[vl.type][i]["ds-name"]
				except KeyError:
					type_instance = ""
			try:
				type = self.types[vl.type][i]
			except KeyError:
				type = None
			try:
				unit=str(self.typeinfo[vl.type]['unit'])
			except:
				unit="unknown"
			name= vl.plugin
			if vl.plugin_instance != "":
				name += "-" + vl.plugin_instance
			name += "/" + vl.type
			if type_instance != "" and type_instance != "value":
				name += "-" + type_instance

			convertedValue = self.convertValue(vl.host, name, val, vl.time, type)
			if convertedValue != None:
				jsonPoint = '{"host": "%s", "unit": "%s", "val": "%d", "pointname": "%s", "time": "%d"}' % (
					vl.host,
					unit,
					convertedValue,
					name,
					vl.time
				)
				self.q.put(jsonPoint)
			

	def shutdown(self):
		self.qthread.terminate()
		self.ns.removeServices()

settings=Settings("/etc/nwperf.conf")
typeinfo=settings["collectdtypes"]

TheOne = NWCollectd(typeinfo)
