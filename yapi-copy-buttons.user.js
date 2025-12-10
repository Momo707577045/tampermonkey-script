// ==UserScript==
// @name         Yapi 快速复制按钮
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在 Yapi 工具栏前添加快速复制预设文案的按钮
// @author       You
// @match        *://*/project/*
// @include      /^https?:\/\/([^/]*yapi[^/]*)\/project\/.*$/
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 预设的文案配置 - 可以根据需要修改
    const presetTexts = [
        {
            label: '复制API地址',
            type: 'param',
            text: 'https://api.example.com/v1/endpoint',
        },
        {
            label: '复制Token',
            type: 'param',
            text: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        {
            label: '复制测试账号',
            type: 'param',
            text: 'test@example.com',
        },
        {
            label: '复制密码',
            text: 'Test123456',
        }
    ];

    // 添加样式
    GM_addStyle(`
        .custom-copy-container {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-left: 15px;
            padding: 0 0px;
        }

        .custom-copy-btn {
            position: relative;
            padding: 1px 6px;
            font-size: 12px;
            line-height: 30px;
            background-color: #1890ff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s;
            white-space: nowrap;
        }
        .custom-copy-btn-param {
            background-color: #DA5253;
        }

        .custom-copy-btn:hover {
            opacity: 0.8;
            box-shadow: 0 2px 4px rgba(24, 144, 255, 0.3);
        }

        .custom-copy-btn:active {
            transform: scale(0.98);
        }

        .custom-copy-btn.success {
            background-color: #52c41a;
        }

        .custom-copy-success-msg {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: #52c41a;
            color: white;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            animation: slideIn 0.3s, slideOut 0.3s 2.7s;
        }

        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `);

    // 复制文本到剪贴板
    function copyToClipboard(text, button) {
        // 尝试使用 GM_setClipboard (Tampermonkey 提供)
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(text);
            showSuccessMessage('复制成功！');
        } else {
            // 降级方案：使用 Clipboard API
            navigator.clipboard.writeText(text).then(() => {
                showSuccessMessage('复制成功！');
            }).catch(err => {
                // 最后降级方案：使用传统方法
                fallbackCopy(text);
                showSuccessMessage('复制成功！');
            });
        }
    }

    // 传统复制方法（兼容性方案）
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    // 显示成功消息
    function showSuccessMessage(message) {
        const msg = document.createElement('div');
        msg.className = 'custom-copy-success-msg';
        msg.textContent = message;
        document.body.appendChild(msg);

        setTimeout(() => {
            msg.remove();
        }, 3000);
    }

    // 创建按钮容器
    function createCopyButtons() {
        const container = document.createElement('div');
        container.className = 'custom-copy-container';

        presetTexts.forEach(preset => {
            const button = document.createElement('button');
            button.className = `custom-copy-btn ${preset.type === 'param' ? 'custom-copy-btn-param' : ''}`;
            button.textContent = preset.label;

            // 点击事件
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyToClipboard(preset.text, button);
            });

            container.appendChild(button);
        });

        return container;
    }

    // 初始化脚本
    function init() {
        // 查找 user-toolbar 元素
        const userToolbar = document.querySelector('.user-toolbar');

        if (userToolbar) {
            // 检查是否已经添加过容器
            if (!document.querySelector('.custom-copy-container')) {
                const copyContainer = createCopyButtons();
                // 在 user-toolbar 前面插入容器
                userToolbar.parentNode.insertBefore(copyContainer, userToolbar);
                console.log('Yapi 快速复制按钮已加载');
            }
        }
    }

    // 使用 MutationObserver 监听 DOM 变化，确保在动态加载的页面也能工作
    const observer = new MutationObserver((mutations) => {
        if (document.querySelector('.user-toolbar') && !document.querySelector('.custom-copy-container')) {
            init();
        }
    });

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 开始观察 DOM 变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 页面完全加载后再尝试一次
    window.addEventListener('load', () => {
        setTimeout(init, 500);
    });

})();

