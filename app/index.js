"use strict";

document.getElementById('appversion').innerText = app.version;

var TOTP = require('./totp');

var ProgressBar = require('progressbar.js');
var QRCode = require('qrcodejs2');

function buildOTPauthUrl(secret, account, issuer){
  return 'otpauth://totp/' + encodeURIComponent(account) + '?secret=' + encodeURIComponent(secret) + '&issuer=' + encodeURIComponent(issuer);
}

function parseOTPauthUrl(otpauthUrlString){
  var otpauthUrl = new URL(otpauthUrlString);
  
  var result = {};
  
  if(otpauthUrl.searchParams.get('secret')){
    result.secret = decodeURIComponent(otpauthUrl.searchParams.get('secret'));
  }
  
  var label = decodeURIComponent(otpauthUrl.pathname.replace(RegExp('^//totp/'), ''));
  if(!label.includes(":")){
    result.account = label;
  } else {
    result.account = label.split(':')[1];
    result.issuer = label.split(':')[0];
  }
  if(otpauthUrl.searchParams.get('issuer')){
    result.issuer = decodeURIComponent(otpauthUrl.searchParams.get('issuer'));
  }
  
  return result;
}

function copyToClipboard(value) {
  // Create a temporary input
  var input = document.createElement("input");
  // Append it to body
  document.body.appendChild(input);

  // Set input value
  input.setAttribute("value", value);
  // Select input value
  input.select();
  // Copy input value
  document.execCommand("copy");

  // Remove input from body
  document.body.removeChild(input);
}

function showToast(value, timeout) {
  timeout = timeout || 2000;

  var toastElement = document.createElement("div");
  toastElement.classList.add('toast');
  toastElement.innerText = value;

  document.body.appendChild(toastElement);
  setTimeout(function() {
    document.body.removeChild(toastElement);
  }, timeout);
}

var totpRemainingSecondsCircle = new ProgressBar.Circle(document.getElementById('totp-token-remaining-seconds-circle'), {
  strokeWidth: 50,
  duration: 1000,
  color: 'inherit', // null to support css styling
  trailColor: 'transparent' //  null to support css styling
});
totpRemainingSecondsCircle.svg.style.transform = 'scale(-1, 1)';

var qrImage = new QRCode(document.getElementById('otpauth-qr'), {
  colorDark: "#000000",
  colorLight: "#ffffff",
  correctLevel: QRCode.CorrectLevel.Q
});
qrImage._el.getElementsByTagName("img")[0].style.width = '100%'; // FIX: scaling problem with padding

var update = function() {
  var secret = document.getElementById('inputSecret').value;
  var issuer = document.getElementById('inputIssuer').value;
  var account = document.getElementById('inputAccount').value;
  
  if (secret.startsWith("otpauth://totp/")) {
    var otpauthParameters = parseOTPauthUrl(secret);
    secret = otpauthParameters.secret || ' ';
    issuer = otpauthParameters.issuer;
    account = otpauthParameters.account;
  }
  
  document.getElementById('inputSecret').value = secret || '';
  document.getElementById('inputIssuer').value = issuer || '';
  document.getElementById('inputAccount').value = account || '';
  
  if(secret && account){
    var otpauthUrl = buildOTPauthUrl(secret, account, issuer);
    qrImage.makeCode(otpauthUrl);
    qrImage._el.removeAttribute("title"); // WORKAROUND: prevent showing otpauthUrl in html
  } else {
    qrImage._el.getElementsByTagName("img")[0].src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="; // WORKAROUND: clean image
  }
};

// ################  input handling  ##################

document.getElementById('inputIssuer').addEventListener('input', update, false);
document.getElementById('inputAccount').addEventListener('input', update, false);
document.getElementById('inputSecret').addEventListener('input', update, false);

['click', 'tap'].forEach(function(event) {
  document.getElementById('totp-token').addEventListener(event, function() {
    copyToClipboard(this.innerText.replace(/\s/g, ''));
    showToast("Token copied!");
  }, false);
});

['click', 'tap'].forEach(function(event) {
  document.getElementById('otpauth-qr').addEventListener(event, function() {
    var secret = document.getElementById('inputSecret').value;
    var account = document.getElementById('inputAccount').value;
    var issuer = document.getElementById('inputIssuer').value;
    var otpauthUrl = buildOTPauthUrl(secret, account, issuer);
    copyToClipboard(otpauthUrl);
    showToast("OTPAuth url copied!");
  }, false);
});

['click', 'tap'].forEach(function(event) {
  document.getElementById('button-otpauth-qr').addEventListener(event, function(e) {
    var otpauthQrImageElement = document.getElementById('otpauth-qr');
    var accountInputElement = document.getElementById('inputAccount');
    var issuerInputElement = document.getElementById('inputIssuer');
    if (otpauthQrImageElement.style.display == 'none') {
      otpauthQrImageElement.style.display = "";
      accountInputElement.style.display = "";
      issuerInputElement.style.display = "";
    } else {
      otpauthQrImageElement.style.display = "none";
      accountInputElement.style.display = "none";
      issuerInputElement.style.display = "none";
    }
  }, false);
});

// ################  run  ##################

var urlSearchParams = new URLSearchParams(window.location.search.replace(/_=.*$/, ""));
var secret = urlSearchParams.get('secret');
var otpauthUrl = document.location.search.replace(/^(.*_=)|(.*)/, ""); //'...?_=otpauth://totp/ACCOUNT?secret=JBSWY3DPEHPK3PXP&issuer=ISSUER';

document.getElementById('inputSecret').value = otpauthUrl || secret;

// remove searchParams
history.pushState(history.state, document.title, window.location.pathname);

update();

setInterval(refresh_totp, 1000);

function refresh_totp() {
  var totpTokenElement = document.getElementById('totp-token');

  var secret = document.getElementById('inputSecret').value;
  if (secret) {
    secret = secret.replace(/\s/g, '');
    var totp = new TOTP(secret);
    try {
      totpTokenElement.innerHTML = totp.getToken().replace(/(...)(?=.)/g, "$& ");
      if (totp.getRemainingSeconds() / 30.0 <= 0) {
        totpRemainingSecondsCircle.set(1.0);
      } else {
        totpRemainingSecondsCircle.animate(totp.getRemainingSeconds() / 30.0);
      }
    } catch (err) {
      console.log(err);
      totpTokenElement.innerHTML = "Invalid Secret!";
      totpRemainingSecondsCircle.set(0.0);
    }
  } else {
    totpTokenElement.innerHTML = '';
    totpRemainingSecondsCircle.set(0.0);
  }
}
