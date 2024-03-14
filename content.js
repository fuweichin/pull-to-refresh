function main() {
  const root = document.documentElement;
  if (root.nodeName.toLowerCase() !== 'html')
    return;
  const env = {
    EDGE: navigator.userAgent.includes('Edg/'),
    FIREFOX: navigator.userAgent.includes('Firefox/'),
    MACOS: navigator.userAgent.includes('Macintosh')
  };
  const settings = {
    indicatorWidth: env.EDGE ? 60 : env.FIREFOX ? 60 : 70,
    deltaYThreshold1: Math.max(window.innerHeight / 4, 180) | 0,
    deltaYThreshold2: Math.max(window.innerHeight / 2, 360) | 0
  };
  let indicator;
  let styleSheet;
  let ensureIndicator = () => {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-to-refresh';
      indicator.appendChild(document.createTextNode('⟳'));
      let textContent = /*css*/`.pull-to-refresh {
  font-weight: bold;
  background-clip: padding-box;
  text-align: center;
  box-sizing: border-box;
  position: fixed;
  z-index: 9999;
  transition: color 0.2s ease-in-out, background-color 0.2s ease-in-out;
  &.chrome {
    top: -70px;
    left: calc(50% - 35px);
    width: 70px;
    height: 70px;
    border: 15px solid rgba(26, 115, 232, 0.2);
    border-radius: 35px;
    line-height: 40px;
    font-size: 32px;
    color: #1a73e8;
    background-color: #ffffff;
  }
  &.chrome.activated {
    background-color: #1a73e8;
    color: #ffffff;
  }
  &.edge {
    top: -60px;
    left: calc(50% - 30px);
    width: 60px;
    height: 60px;
    border: 2px solid rgba(26, 115, 232, 1);
    border-radius: 30px;
    font-size: 32px;
    line-height: 56px;
    color: #c1c1c1;
    background-color: #ffffff;
  }
  &.edge.activated {
    color: #333333;
  }
  &.firefox {
    top: -60px;
    left: calc(50% - 30px);
    width: 60px;
    height: 60px;
    border: 10px solid transparent;
    border-radius: 30px;
    font-size: 32px;
    line-height: 40px;
    color: #01d8fb;
    background-color: #000000;
  }
  &.firefox.activated {
    border: 10px solid rgba(1, 216, 251, 0.5);
    background-color: #00ddff;
    color: #000d0f;
  }
}`;
      if (env.FIREFOX) {
        indicator.classList.add('firefox');
        // adoptedStyleSheets cannot be set in Firefox extension, why?
        styleSheet = document.createElement('style');
        styleSheet.textContent = textContent;
        document.head.appendChild(styleSheet);
      } else {
        indicator.classList.add(env.EDGE ? 'edge' : 'chrome');
        styleSheet = new CSSStyleSheet();
        styleSheet.replaceSync(textContent);
        document.adoptedStyleSheets.push(styleSheet);
      }
      document.body.appendChild(indicator);
    } else {
      indicator.classList.remove('activated');
      indicator.style.top = '-70px';
      indicator.style.transform = 'rotate(0deg)';
      if (env.FIREFOX) {
        if (styleSheet.parentNode !== document.head)
          document.head.appendChild(styleSheet);
      } else {
        if (!document.adoptedStyleSheets.includes(styleSheet))
          document.adoptedStyleSheets.push(styleSheet);
      }
      if (indicator.parentNode !== document.body)
        document.body.appendChild(indicator);
    }
    return indicator;
  };
  // to support touchscreens
  let listenTouchEvent = () => {
    let {indicatorWidth, deltaYThreshold1, deltaYThreshold2} = settings;
    let startingTouch = null;
    let lastTouch = null;
    let numMoves = 0;
    let pulling = false;
    let activated = false;
    let bodyStyle = getComputedStyle(document.body);
    let canPullToRefresh = () => {
      return window.scrollY === 0 && bodyStyle.overscrollBehaviorY === 'auto' && bodyStyle.touchAction !== 'none';
    };
    let endPulling = () => {
      if (!startingTouch)
        return;
      // console.debug('end pulling');
      if (indicator && indicator.parentNode === document.body)
        document.body.removeChild(indicator);
      startingTouch = null;
      root.removeEventListener('touchmove', touchmoveHandler, {passive: false});
      root.removeEventListener('touchend', touchendHandler);
      root.removeEventListener('touchcancel', touchendHandler);
    };
    let touchstartHandler = (e) => {
      if (e.defaultPrevented)
        return;
      if (canPullToRefresh() && getComputedStyle(e.target).touchAction !== 'none') {
        if (!startingTouch && e.touches.length === 1) {
          pulling = false;
          numMoves = 0;
          activated = false;
          startingTouch = e.changedTouches[0];
          lastTouch = startingTouch;
          root.addEventListener('touchmove', touchmoveHandler, {passive: false});
          root.addEventListener('touchend', touchendHandler);
          root.addEventListener('touchcancel', touchendHandler);
        } else if (startingTouch) {
          endPulling();
        }
      }
    };
    let touchmoveHandler = (e) => {
      let touch;
      if (!startingTouch || e.defaultPrevented || e.touches.length > 1 ||
        !(touch = Array.prototype.find.call(e.changedTouches, (t) => t.identifier === startingTouch.identifier))) {
        return;
      }
      let totalDeltaY = touch.clientY - startingTouch.clientY;
      let deltaY = touch.clientY - lastTouch.clientY;
      lastTouch = touch;
      let deltaX = touch.clientX - lastTouch.clientX;
      if (pulling) {
        if (deltaY < 0 && e.cancelable) {
          e.preventDefault();
        }
        let y = totalDeltaY - deltaYThreshold1;
        if (y > 0) {
          let offsetTop;
          if (y > deltaYThreshold2) {
            if (!activated) {
              activated = true;
              indicator.classList.add('activated');
            }
            let y2 = Math.round(Math.log(y - deltaYThreshold2) / Math.log(1.25));
            offsetTop = (deltaYThreshold2 / 3) + y2;
            indicator.style.top = (-indicatorWidth + offsetTop) + 'px';
          } else {
            if (activated) {
              activated = false;
              indicator.classList.remove('activated');
            }
            offsetTop = y / 3;
            indicator.style.top = (-indicatorWidth + offsetTop) + 'px';
          }
          indicator.style.transform = `rotate(${offsetTop}deg)`;
        } else {
          let offsetTop = 0;
          indicator.style.top = -indicatorWidth + 'px';
          indicator.style.transform = `rotate(${offsetTop}deg)`;
        }
      } else {
        if (deltaY < 0 || deltaY < Math.abs(deltaX)) {
          endPulling();
          return;
        }
        if (++numMoves > 2) {
          ensureIndicator();
          pulling = true;
          // console.debug('start pulling');
        }
      }
    };
    let touchendHandler = (e) => {
      if (!startingTouch ||
        !(Array.prototype.find.call(e.changedTouches, (t) => t.identifier === startingTouch.identifier))) {
        return;
      }
      let willRefresh = activated;
      endPulling();
      if (willRefresh) {
        requestAnimationFrame(() => {
          location.reload();
        });
      }
    };
    root.addEventListener('touchstart', touchstartHandler);
  };
  // to support precision touchpads
  let listenWheelEvent = () => {
    let {indicatorWidth, deltaYThreshold1, deltaYThreshold2} = settings;
    let totalWheelDeltaY = null;
    let numMoves = 0;
    let pulling = false;
    let activated = false;
    let bodyStyle = getComputedStyle(document.body);
    let canPullToRefresh = () => {
      return window.scrollY === 0 && bodyStyle.overscrollBehaviorY === 'auto';
    };
    let allowPull = canPullToRefresh();
    let firstRun = true;
    let lastEndTime = performance.now();
    document.addEventListener('scrollend', (e) => {
      firstRun = true;
      allowPull = canPullToRefresh();
    });
    let endPulling = () => {
      // console.debug('end pulling');
      pulling = false;
      if (indicator && indicator.parentNode === document.body)
        document.body.removeChild(indicator);
    };
    let wheelHandler = (e) => {
      if (!allowPull || e.defaultPrevented)
        return;
      let {deltaY, deltaX} = e;
      // skip non-precision touchpad
      if (!(e.wheelDeltaY === -deltaY && e.wheelDeltaX === -deltaX))
        return;
      // skip zooming
      // if (deltaY !== 0 && deltaX === 0 && e.ctrlKey)
      //   return;
      // regard zero delta as finger lift
      if (deltaY === 0 && deltaX === 0) {
        lastEndTime = e.timeStamp;
        firstRun = true;
        wheelendHandler();
        return;
      }
      // Try to cancel the first wheel event in a sequence in order to make following wheel events cancelable
      // see https://github.com/WICG/interventions/issues/33
      if (firstRun) {
        firstRun = false;
        if (window.scrollY === 0 && deltaY < 0 && e.cancelable &&
          deltaY < -Math.abs(deltaX)) { // not to mess up overscroll-behavior-x
          e.preventDefault();
        }
      }
      if (pulling) {
        if (deltaY > 0 && e.cancelable) {
          e.preventDefault();
        }
        totalWheelDeltaY += deltaY;
        let y = -totalWheelDeltaY - deltaYThreshold1;
        if (y > 0) {
          let offsetTop;
          if (y > deltaYThreshold2) {
            if (!activated) {
              activated = true;
              indicator.classList.add('activated');
            }
            let y2 = Math.round(Math.log(y - deltaYThreshold2) / Math.log(1.25));
            offsetTop = (deltaYThreshold2 / 3) + y2;
            indicator.style.top = (-indicatorWidth + offsetTop) + 'px';
          } else {
            if (activated) {
              activated = false;
              indicator.classList.remove('activated');
            }
            offsetTop = y / 3;
            indicator.style.top = (-indicatorWidth + offsetTop) + 'px';
          }
          indicator.style.transform = `rotate(${offsetTop}deg)`;
        } else {
          let offsetTop = 0;
          indicator.style.top = -indicatorWidth + 'px';
          indicator.style.transform = `rotate(${offsetTop}deg)`;
        }
      } else {
        if (window.scrollY === 0 && totalWheelDeltaY === null && deltaY < 0) {
          // ignore extra wheel events followed by finger lift
          if (e.timeStamp - lastEndTime < 200)
            return;
          // skip if overscrollBehaviorY of target is 'none' or 'contain'
          if (getComputedStyle(e.target).overscrollBehaviorY !== 'auto')
            return;
          numMoves = 0;
          activated = false;
          totalWheelDeltaY = deltaY;
        } else if (totalWheelDeltaY !== null) {
          totalWheelDeltaY += deltaY;
          if (deltaY < 0) {
            // try not to conflict with horizontal swipe (overscroll history navigation)
            if (deltaX < 0 ? deltaY < deltaX : deltaY > -deltaX) {
              totalWheelDeltaY = null;
              return;
            }
            if (++numMoves > 2) {
              // console.debug('start pulling');
              ensureIndicator();
              pulling = true;
            }
          }
        }
      }
    };
    let wheelendHandler = () => {
      totalWheelDeltaY = null;
      if (pulling) {
        endPulling();
      }
      if (activated) {
        requestAnimationFrame(() => {
          location.reload();
        });
      }
    };
    root.addEventListener('wheel', wheelHandler, {passive: false});
  };
  if (env.FIREFOX) {
    // It's hard to detect precision touchpad in Firefox
  } else if (env.MACOS) {
    // It's hard to detect finger lift of precision touchpad in Chrome for macOS
  } else {
    listenWheelEvent();
  }
  listenTouchEvent();
}
requestIdleCallback(main);
