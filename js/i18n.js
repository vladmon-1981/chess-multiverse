/*
 * Язык интерфейса: русский (исходный текст в коде) и английский (словарь в js/i18n-en.js).
 * Язык берётся из системы: navigator.language (в приложении WKWebView отдаёт язык iOS).
 * ru, be, kk → русский, всё остальное → английский. Для отладки: index.html?lang=en или ?lang=ru.
 *
 * tr('Русский текст {имя}', { имя: значение }) — перевод по самому русскому тексту.
 * Статические надписи в index.html переводит applyDom() по тексту узла и атрибутам
 * title, aria-label, placeholder, content.
 */
(function () {
    'use strict';

    let forced = null;
    try { forced = new URLSearchParams(location.search).get('lang'); } catch (e) { /* file:// без query */ }
    const nav = forced || (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    const lang = /^(ru|be|kk)/i.test(nav) ? 'ru' : 'en';

    const I18N = { lang, en: {}, themes: {}, plain: null };

    function fill(s, vars) {
        if (!vars) return s;
        return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    }

    /** Перевод строки по её русскому тексту; в русской локали возвращает её же. */
    function tr(ru, vars) {
        let s = ru;
        if (lang === 'en') {
            const e = I18N.en[ru];
            if (e !== undefined) s = e;
            else if (I18N.debug) console.warn('i18n: нет перевода для', ru);
        }
        return fill(s, vars);
    }

    /** Склонение: у русского три формы, у английского две (one — для 1, many — для остального). */
    function plural(n, one, few, many, enOne, enMany) {
        if (lang === 'en') return n === 1 ? (enOne || one) : (enMany || many);
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
        return many;
    }

    const ATTRS = ['title', 'aria-label', 'placeholder', 'content', 'alt'];

    /** Переводит статическую разметку один раз при загрузке. */
    function applyDom(root) {
        if (lang !== 'en') return;
        const base = root || document;
        document.documentElement.lang = 'en';
        const walker = document.createTreeWalker(base.body || base, NodeFilter.SHOW_TEXT);
        const nodes = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
        for (const n of nodes) {
            const raw = n.nodeValue, t = raw.trim();
            if (!t || !/[А-Яа-яЁё]/.test(t)) continue;
            const e = I18N.en[t];
            if (e !== undefined) n.nodeValue = raw.replace(t, e);
            else if (I18N.debug) console.warn('i18n: нет перевода для', t);
        }
        const els = (base.documentElement || base).querySelectorAll('*');
        for (const el of els) {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
            for (const a of ATTRS) {
                const v = el.getAttribute(a);
                if (v && /[А-Яа-яЁё]/.test(v)) {
                    const e = I18N.en[v.trim()];
                    if (e !== undefined) el.setAttribute(a, e);
                    else if (I18N.debug) console.warn('i18n: нет перевода для', v);
                }
            }
        }
        const title = document.querySelector('title');
        if (title && I18N.en[title.textContent.trim()]) title.textContent = I18N.en[title.textContent.trim()];
    }

    /** Глубокое слияние английских текстов тем в THEMES (вызывается из themes.js). */
    function merge(target, src) {
        for (const k of Object.keys(src)) {
            const v = src[k];
            if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') merge(target[k], v);
            else target[k] = v;
        }
        return target;
    }

    I18N.tr = tr;
    I18N.plural = plural;
    I18N.applyDom = applyDom;
    I18N.merge = merge;
    window.I18N = I18N;
    window.tr = tr;
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
})();
