// content.js
const EXTENSION_VERSION = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest().version
    : 'dev';
const AUTH_LOGIN_PATH = '/authserver/login';
if (window.location.pathname === AUTH_LOGIN_PATH) {
    console.log(`NJU 验证码识别助手 v${EXTENSION_VERSION} 已启动...`);
}

let captchaStatusTimer = null;

function getCaptchaStatusNotice() {
    let notice = document.getElementById('nju-captcha-status-notice');
    if (notice) return notice;

    notice = document.createElement('div');
    notice.id = 'nju-captcha-status-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.style.cssText = [
        'position:fixed',
        'top:16px',
        'right:24px',
        'z-index:2147483647',
        'display:none',
        'align-items:center',
        'gap:12px',
        'max-width:min(340px,calc(100vw - 48px))',
        'padding:12px 16px',
        'border:0.5px solid rgba(255,255,255,0.4)',
        'border-radius:999px',
        'background:rgba(250,251,253,0.75)',
        '-webkit-backdrop-filter:blur(20px) saturate(180%)',
        'backdrop-filter:blur(20px) saturate(180%)',
        'color:#1d1d1f',
        'font:600 13px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif',
        'box-shadow:0 10px 30px rgba(0,0,0,0.1),0 1px 3px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.7)',
        'opacity:0',
        'transform:translateY(-16px) scale(0.95)',
        'transition:opacity .25s ease,transform .4s cubic-bezier(0.2, 0.8, 0.2, 1)'
    ].join(';');

    const indicator = document.createElement('span');
    indicator.dataset.njuCaptchaStatusIcon = 'true';
    indicator.style.cssText = 'flex:0 0 auto;width:16px;height:16px;border:2px solid rgba(0,122,255,0.2);border-top-color:#007aff;border-radius:50%;animation:njuCaptchaStatusSpin .75s linear infinite';

    const text = document.createElement('span');
    text.dataset.njuCaptchaStatusText = 'true';
    notice.append(indicator, text);
    document.body.appendChild(notice);

    const style = document.createElement('style');
    style.textContent = '@keyframes njuCaptchaStatusSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    return notice;
}

function showCaptchaStatus(message, state = 'loading', autoHideMs = 0) {
    if (captchaStatusTimer) {
        clearTimeout(captchaStatusTimer);
        captchaStatusTimer = null;
    }

    const notice = getCaptchaStatusNotice();
    const indicator = notice.querySelector('[data-nju-captcha-status-icon]');
    const text = notice.querySelector('[data-nju-captcha-status-text]');
    const colors = {
        loading: '#634798',
        success: '#14804a',
        warning: '#9a6700',
        error: '#b42318'
    };

    text.textContent = message;
    if (state === 'loading') {
        indicator.textContent = '';
        indicator.style.cssText = 'flex:0 0 auto;width:18px;height:18px;border:2px solid #c8bedc;border-top-color:#634798;border-radius:50%;animation:njuCaptchaStatusSpin .75s linear infinite';
    } else {
        indicator.textContent = state === 'success' ? '✓' : state === 'warning' ? '!' : '×';
        indicator.style.cssText = `display:grid;place-items:center;flex:0 0 auto;width:18px;height:18px;border-radius:50%;background:${colors[state]};color:#fff;font:700 12px/18px system-ui`;
    }

    notice.style.display = 'flex';
    requestAnimationFrame(() => {
        notice.style.opacity = '1';
        notice.style.transform = 'translateY(0)';
    });

    if (autoHideMs > 0) {
        captchaStatusTimer = setTimeout(hideCaptchaStatus, autoHideMs);
    }
}

function hideCaptchaStatus() {
    const notice = document.getElementById('nju-captcha-status-notice');
    if (!notice) return;
    notice.style.opacity = '0';
    notice.style.transform = 'translateY(-8px)';
    captchaStatusTimer = setTimeout(() => {
        notice.style.display = 'none';
    }, 180);
}

let isSolving = false; // 互斥锁，防止并发重复执行

async function solveCaptcha() {
    if (isSolving) {
        console.log("NJU 助手：自动登录正在进行中，跳过重复调用。");
        return;
    }
    isSolving = true;

    try {
        await _solveCaptchaImpl();
    } finally {
        isSolving = false;
    }
}

function isAuthserverLoginPage() {
    return window.location.pathname === AUTH_LOGIN_PATH;
}

function isVisibleElement(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return element.getClientRects().length > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
}

function findPasswordLoginContext() {
    // The live authserver page contains two forms with the same pwdFromId.
    // Select the rendered one and keep all duplicate-ID field queries form-scoped.
    const forms = Array.from(document.querySelectorAll('form#pwdFromId'));
    for (const form of forms) {
        if (!isVisibleElement(form)) continue;
        const username = form.querySelector('input[name="username"]');
        const password = form.querySelector('#password');
        const encryptedPassword = form.querySelector('#saltPassword');
        const passwordSalt = form.querySelector('#pwdEncryptSalt');
        const submitButton = form.querySelector('#login_submit');
        if (username && password && encryptedPassword && passwordSalt && submitButton) {
            return { form, username, password, encryptedPassword, passwordSalt, submitButton };
        }
    }
    return null;
}

function isSliderCaptchaPage() {
    const sliderContainer = document.getElementById('sliderCaptchaDiv');
    if (!sliderContainer) return false;
    return Array.from(document.scripts).some(script => /captchaSwitch\s*=\s*["']2["']/.test(script.textContent || ''));
}

function setNativeFieldValue(element, value) {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillPasswordLoginContext(context, settings) {
    const force = Boolean(settings.nju_force);
    if ((force || !context.username.value.trim()) && settings.nju_user) {
        setNativeFieldValue(context.username, settings.nju_user);
    }
    if ((force || !context.password.value) && settings.nju_pass) {
        context.password.removeAttribute('readonly');
        setNativeFieldValue(context.password, settings.nju_pass);
    }
    return Boolean(context.username.value.trim() && context.password.value);
}

async function checkAuthserverNeedsCaptcha(username) {
    const endpoint = new URL(`/authserver/checkNeedCaptcha.htl?username=${encodeURIComponent(username)}`, window.location.origin);
    const request = await fetch(endpoint.href, {
        method: 'GET',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (!request.ok) throw new Error(`验证码状态检查失败 (${request.status})`);
    const result = await request.json();
    return Boolean(result?.isNeed);
}

async function submitPasswordLoginContext(context) {
    const sliderRuntime = window.NjuAuthSliderCaptcha;
    if (!sliderRuntime?.encryptForPage) throw new Error('滑块认证运行时未加载');
    const encrypted = await sliderRuntime.encryptForPage(context.password.value, context.passwordSalt.value);
    setNativeFieldValue(context.encryptedPassword, encrypted);
    context.password.setAttribute('disabled', 'disabled');
    HTMLFormElement.prototype.submit.call(context.form);
}

function openManualSliderFallback(context, reason) {
    window.NjuAuthLoginFastPath?.unlock?.();
    showCaptchaStatus(reason || '安全验证需要手动完成', 'warning', 5200);
    context.password.removeAttribute('disabled');
    context.submitButton.click();
}

async function submitAuthenticatedPassword(context) {
    try {
        await submitPasswordLoginContext(context);
        return true;
    } catch (error) {
        console.warn('NJU 助手：无法提交新版认证表单:', error);
        openManualSliderFallback(context, '自动提交失败，已打开官方滑块');
        return false;
    }
}

async function solveSliderAuthentication(settings, context) {
    const hasCredentials = fillPasswordLoginContext(context, settings);
    const username = context.username.value.trim();
    if (!hasCredentials || !username) {
        showCaptchaStatus('请先在插件中保存账号和密码', 'warning', 4200);
        return;
    }
    if (settings.nju_auto_click === false) {
        showCaptchaStatus('账号已填入，自动登录已暂停', 'success', 3600);
        return;
    }

    let needsCaptcha;
    try {
        showCaptchaStatus('正在检查登录状态...', 'loading');
        needsCaptcha = await checkAuthserverNeedsCaptcha(username);
    } catch (error) {
        console.warn('NJU 助手：无法检查新版验证码状态:', error);
        openManualSliderFallback(context, '无法检查安全验证，请使用页面滑块');
        return;
    }

    if (!needsCaptcha) {
        showCaptchaStatus('无需安全验证，正在登录...', 'success');
        await submitAuthenticatedPassword(context);
        return;
    }

    const sliderRuntime = window.NjuAuthSliderCaptcha;
    if (!sliderRuntime?.solve) {
        openManualSliderFallback(context, '滑块识别模块未加载，请使用页面滑块');
        return;
    }

    showCaptchaStatus('正在完成安全验证...', 'loading');
    const result = await sliderRuntime.solve({
        attempts: 3,
        onStatus: state => {
            if (state.phase === 'matching') showCaptchaStatus(`正在定位拼图缺口（${state.attempt}/3）...`, 'loading');
            if (state.phase === 'verifying') showCaptchaStatus(`正在验证安全校验（${state.attempt}/3）...`, 'loading');
        }
    });
    if (!result.ok) {
        console.warn('NJU 助手：滑块自动验证未通过:', result.error);
        openManualSliderFallback(context, '自动安全验证未通过，已打开官方滑块');
        return;
    }

    console.log(
        `NJU 助手：滑块验证通过，缺口 ${result.match.moveLength}px，`
        + `score ${result.match.confidence.toFixed(3)}，margin ${result.match.margin.toFixed(3)}`
    );
    showCaptchaStatus('安全验证通过，正在登录...', 'success');
    await submitAuthenticatedPassword(context);
}

async function consumeFastAuthLogin(settings, context) {
    const fastPath = window.NjuAuthLoginFastPath;
    if (!fastPath?.getResult || !isSliderCaptchaPage()) return false;

    const snapshot = fastPath.getSnapshot?.();
    if (snapshot?.phase && !['ready', 'failed', 'error', 'not-slider', 'skipped'].includes(snapshot.phase)) {
        showCaptchaStatus('正在完成安全验证...', 'loading');
    }

    const outcome = await fastPath.getResult();
    if (!outcome || ['ignored', 'skipped', 'not-slider', 'error'].includes(outcome.kind)) return false;

    const hasCredentials = fillPasswordLoginContext(context, settings);
    if (!hasCredentials || settings.nju_auto_click === false) return false;
    if (outcome.username && context.username.value.trim() !== outcome.username) return false;

    if (outcome.kind === 'no-captcha') {
        showCaptchaStatus('无需安全验证，正在登录...', 'success');
        await submitAuthenticatedPassword(context);
        return true;
    }

    if (outcome.kind === 'slider') {
        if (!outcome.sliderResult?.ok) {
            console.warn('NJU 助手：快速滑块验证未通过:', outcome.sliderResult?.error);
            openManualSliderFallback(context, '自动安全验证未通过，已打开官方滑块');
            return true;
        }
        showCaptchaStatus('安全验证通过，正在登录...', 'success');
        await submitAuthenticatedPassword(context);
        return true;
    }

    return false;
}

async function _solveCaptchaImpl() {
    const settings = await chrome.storage.local.get(['nju_enabled', 'nju_user', 'nju_pass', 'nju_force', 'nju_auto_click']);
    if (settings.nju_enabled === false) {
        console.log("NJU 助手：当前处于关闭状态。");
        return;
    }

    const passwordLoginContext = findPasswordLoginContext();
    if (passwordLoginContext && isSliderCaptchaPage()) {
        if (await consumeFastAuthLogin(settings, passwordLoginContext)) return;
        await solveSliderAuthentication(settings, passwordLoginContext);
    }
}

// Only the login route owns automatic (slider) login. The content script also
// matches post-login authserver pages, where no login should be triggered.
if (isAuthserverLoginPage()) {
    // At document_idle the password form is typically ready; the slider flow is
    // started at document_start by auth-login-fast.js and consumed here.
    void solveCaptcha();
}
