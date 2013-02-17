/**
 * 数据模块异步加载类，用于异步加载css、js文件。
 * @author terence.wangt
 * date:2013.02.17
 
   jEngine框架介绍文档: http://wd.alibaba-inc.com/doc/page/work/cbu-market/common/jEngine
 */
!(function($){
	
	var Sandbox,
		configs = {
			styleDomain:"style.china.alibaba.com",
		end:0
	},
	modules = {},
	doc = document,
	cssLinks = {};

	function ModuleLoader(sb) {

		Sandbox = sb;
		return ModuleLoader;
	}
	//单实例类
	$.extend(ModuleLoader,{
	
		/**
		 * Add Module
		 * @method add
		 * @static
		 * @param  {string|array} names new module(s) name.
		 * @param  {function} callback call when added this module.
		 * @param  {object} configs module configs.
		 */
		add: function(names, callback, configs){
		  names = ($.isArray(names) ? names : names.replace(/\s+/g, '').split(','));
		  if ($.isPlainObject(callback)) {
			configs = callback;
			callback = undefined;
		  }
		  for (var i = 0, len = names.length; i < len; i++) {
			var name = names[i], o = modules[name];
			if (o) {
			  if (!configs) {
				//$.log('Exist Module ' + name);
				o.status = 'ready';
			  }
			} else {
			  modules[name] = $.extendIf(configs ||
			  {
				status: 'ready'
			  }, {
				ver: '1.0'
			  });
			  //$.log('Module ' + name + ' added!');
			}
		  }
		  //callback 
		  if ($.isFunction(callback)) {
			callback();
		  }
		},
		
		/**
		 * Use Modules
		 * @method use
		 * @static
		 * @param  {string|array} names module(s) name(s).
		 * @param  {function} callback call when use this module succesfully.
		 * @param	{bolean|object} extend default configs
		 */
		use: function(names, callback, options){
		  
		  var self = this;
		  var deferred = jQuery.Deferred();
		  names = ($.isArray(names) ? names : $.unique(names.replace(/\s+/g, '').split(',')));
		  var count = 0;
		  
		  if ($.type(callback) === 'boolean' || $.type(callback) === 'object') {
			options = callback;
			callback = undefined;
		  }
		  $.each(names, function(i, name){
			var configs = modules[name];
			if (configs) {
			  //只有是数据模块，且当用户更改配置，且队列中没有回调函数时。更新配置、刷新数据
			  if (options && configs.url) {
				if (typeof options === 'boolean') {
				  options = {};
				}
				$.extend(configs, options, {
				  status: configs.callbackQueue ? 'refresh' : 'reset'
				});
			  }
			  if (configs.status === 'ready') {

				through(configs._data);
			  } else {
				if (options) {
				  $.extend(configs, options);
				}
				if (configs.requires) {
				  self.use(configs.requires, function(){
					self.init(name, through, deferred);
				  });
				} else {
				  self.init(name, through, deferred);
				}
			  }
			} else {
			  $.error('Invalid Module ' + name);
			}
		  });
		  function through(data){
			count++;
			if (names.length === count) {
			  if ($.isFunction(callback)) {
				callback(data);
			  }
			  deferred.resolve(data);
			}
		  }
		  return deferred.promise();
		},
		
			
		/**
	   * init single module
	   * @method init
	   * @private
	   * @param  {name} module name.
	   * @param  {function} callback callback.
	   * @param  {object} jQuery Deferred对象
	   */
	   init: function(name, callback, deferred){
			
			var self = this;
			var configs = modules[name], url = configs.url, css = configs.css, js = configs.js;

			if (url || $.isArray(js) || $.isArray(css)) {
			  configs.callbackQueue = configs.callbackQueue || [];
			  configs.callbackQueue[configs.callbackQueue.length] = callback;
			  if (configs.callbackQueue.length === 1 || configs.status === 'refresh') {

				var len = 1, q = 0, onSuccess = function(data){
				  q++;
				  if (data) {
					configs._data = data;
				  }
				  if (q === len) {
					configs.status = 'ready';
					$.each(configs.callbackQueue, function(i, callback){
					  callback(data);
					});
					delete configs.callbackQueue;
				  }
				}, onError = function(jqXHR, textStatus){
				  deferred.reject();

				}, onComplete = function(){
				  delete configs.jqxhr;
				};
				//终止原有的ajax
				if (url) {
				  configs.jqxhr && configs.jqxhr.abort();
				  configs.jqxhr = $.ajax(self.extendIf({
					global: false,
					success: onSuccess,
					error: configs.error || onError,
					complete: onComplete
				  }, configs));
				} else {
				  js = js || [];
				  css = css || [];
				  len = js.length + css.length;
				  //load module's CSS
				  $.each(css, function(i, href){
					href = self.substitute(href, [$.styleDomain, configs.ver]);
					self.loadCSS(href, onSuccess);
				  });
				  //load module's JS
				  $.each(js, function(i, src){
					src = self.substitute(src, [$.styleDomain, configs.ver]);

					$.ajax(src, {
					  global: false,
					  dataType: 'script',
					  cache: true,
					  success: onSuccess,
					  error: onError
					});
				  });
				}
			  }
			} else {
			  callback(configs._data);
			}
	   },
		/**
		 * Same as YUI's
		 * @method substitute
		 * @static
		 * @param {string} str string template to replace.
		 * @param {string} data string to deal.
		 * @return {string} the substituted string.
		 */
		substitute: function(str, data){
		  return str.replace(/\{(\w+)\}/g, function(r, m){
			return data[m] !== undefined ? data[m] : '{' + m + '}';
		  });
		},
		
		/**
		 * @method extendIf
		 * @param {Object} target
		 * @param {Object} o
		 */
		extendIf: function(target, o){
		  if (o === undefined) {
			o = target;
			target = this;
		  }
		  for (var p in o) {
			if (typeof target[p] === 'undefined') {
			  target[p] = o[p];
			}
		  }
		  return target;
		},
	
		/**
		 * Generates a link node
		 * @method loadCSS
		 * @version Denis 2012.05.07 参考seajs实现css文件动态载入回调
		 * @static
		 * @param {string} href the href for the css file.
		 * @param {object} attributes optional attributes collection to apply to the new node.
		 * @param {function} Callback Function for onloaded
		 * @return {HTMLElement} the generated node.
		 */
		loadCSS: function(href, attr, callback){
		  // Inspired by code by Andrea Giammarchi
		  // http://webreflection.blogspot.com/2007/08/global-scope-evaluation-and-dom.html
		  var head = doc.getElementsByTagName('head')[0] || doc.documentElement, base = head.getElementsByTagName('base'), link = cssLinks[href], isLoaded;
		  if ($.isFunction(attr)) {
			callback = attr;
			attr = undefined;
		  }
		  //if Exist
		  if (link) {
			callback && callback();
		  } else {
			link = doc.createElement('link');
			var o = {
			  type: 'text/css',
			  rel: 'stylesheet',
			  media: 'screen',
			  href: href
			};
			if ($.isPlainObject(attr)) {
			  $.extend(o, attr);
			}
			
			for (var p in o) {
			  link.setAttribute(p, o[p]);
			}
			cssLinks[href] = link;
			
			callback && styleOnload(link, callback);
		  }
		  
		  // Use insertBefore instead of appendChild to circumvent an IE6 bug.
		  // This arises when a base node is used (#2709).
		  // return link self
		  return base.length ? head.insertBefore(link, base[0]) : head.appendChild(link);
		  
		  /**
		   *
		   * @param {Object} node
		   * @param {Object} callback
		   */
		  function styleOnload(node, callback){
		  
			// for IE6-9 and Opera
			if (node.attachEvent) {
			  node.attachEvent('onload', callback);
			  // NOTICE:
			  // 1. "onload" will be fired in IE6-9 when the file is 404, but in
			  // this situation, Opera does nothing, so fallback to timeout.
			  // 2. "onerror" doesn't fire in any browsers!
			} else { // Polling for Firefox, Chrome, Safari
			  setTimeout(function(){
				poll(node, callback);
			  }, 0); // Begin after node insertion
			}
			
		  }
		  
		  /**
		   *
		   * @param {Object} node
		   * @param {Object} callback
		   */
		  function poll(node, callback){
			if ($.browser.webkit) {
			  if (node['sheet']) {
				isLoaded = true;
			  }
			} else if (node['sheet']) { // for Firefox
			  try {
				if (node['sheet'].cssRules) {
				  isLoaded = true;
				}
			  } catch (ex) {
				// NS_ERROR_DOM_SECURITY_ERR
				if (ex.name === 'SecurityError' || // firefox >= 13.0
					ex.name === 'NS_ERROR_DOM_SECURITY_ERR') { // old firefox
				  isLoaded = true;
				}
			  }
			}
			
			setTimeout(function(){
			  if (isLoaded) {
				// Place callback in here due to giving time for style rendering.
				callback();
			  } else {
				poll(node, callback);
			  }
			}, 0);
		  }
		},
		/**
		 * Remove a link node
		 * @method unloadCSS
		 * @static
		 * @param {string} href the href for the css file.
		 * @return {Bolean} remove success.
		 */
		unloadCSS: function(href){
		  var link = cssLinks[href];
		  if (link) {
			link.parentNode.removeChild(link);
			delete cssLinks[href];
			return true;
		  } else {
			return false;
		  }
		},
		
		
		/**
		 * set the style base domain
		 */
		setStyleDomain:function(domain){
			
			configs.styleDomain = domain;
		},
		
	   end:0
	});
	 
	jEngine.Core.ModuleLoader = ModuleLoader;
	
})(jQuery);