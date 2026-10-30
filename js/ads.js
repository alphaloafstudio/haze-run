/* ads.js - the ONLY file that talks to an ad network.
   Game code calls Ads.* and nothing else. This is the "no ads" version used for
   private playtests and the first public link. To add a portal, replace this file
   with that portal's version (Poki, CrazyGames, AdSense, AdMob). */
window.Ads = {
  loadingFinished(){},
  gameplayStart(){},
  gameplayStop(){},
  showBreak(){ return Promise.resolve(); },
  showRewarded(){ return Promise.resolve(false); }
};
