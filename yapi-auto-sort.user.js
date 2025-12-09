// ==UserScript==
// @name         YApi 接口自动排序
// @version      1.0.1
// @description  为 YApi 特定模块添加接口自动排序功能
// @author       Momo
// @match        *://*/project/*
// @include      /^https?:\/\/([^/]*yapi[^/]*)\/project\/.*$/
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    // 获取 project_id
    function getProjectId() {
        const match = window.location.pathname.match(/\/project\/(\d+)\//);
        return match ? match[1] : null;
    }

    // 获取接口菜单列表
    async function getInterfaceList(projectId) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `/api/interface/list_menu?project_id=${projectId}`);
            xhr.onload = function() {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.errcode === 0) {
                        resolve(data.data);
                    } else {
                        reject(new Error(data.errmsg || '获取接口列表失败'));
                    }
                } catch (e) {
                    reject(e);
                }
            };
            xhr.onerror = function() {
                reject(new Error('网络请求失败'));
            };
            xhr.send();
        });
    }

    // 更新接口索引
    async function updateInterfaceIndex(indexData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/interface/up_index');
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.errcode === 0) {
                        resolve(data);
                    } else {
                        reject(new Error(data.errmsg || '更新接口索引失败'));
                    }
                } catch (e) {
                    reject(e);
                }
            };
            xhr.onerror = function() {
                reject(new Error('网络请求失败'));
            };
            xhr.send(JSON.stringify(indexData));
        });
    }

    // 执行排序
    async function sortInterfaces(categoryName, liElement) {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                alert('无法获取 project_id');
                return;
            }

            // 显示加载中
            const button = liElement.querySelector('.yapi-sort-btn');
            if (button) {
                button.textContent = '排序中...';
                button.disabled = true;
            }

            // 获取接口列表
            const categories = await getInterfaceList(projectId);

            // 找到对应的分类
            const category = categories.find(cat => cat.name === categoryName);
            if (!category) {
                alert(`未找到分类: ${categoryName}`);
                return;
            }

            if (!category.list || category.list.length === 0) {
                alert('该分类下没有接口');
                return;
            }

            // 按主体和动作优先级分组排序
            // 智能识别主体：基于前缀频率分析
            function buildPrefixFrequency(titles) {
                const prefixCount = new Map();
                
                // 统计所有可能的前缀（1到标题长度）
                titles.forEach(title => {
                    for (let len = 1; len <= Math.min(title.length, 10); len++) {
                        const prefix = title.substring(0, len);
                        prefixCount.set(prefix, (prefixCount.get(prefix) || 0) + 1);
                    }
                });
                
                return prefixCount;
            }
            
            function extractSubject(title, prefixFrequency) {
                // 找到该标题中出现频率>1的最长前缀作为主体
                let bestSubject = title.charAt(0); // 至少返回第一个字符
                
                for (let len = 1; len <= Math.min(title.length, 10); len++) {
                    const prefix = title.substring(0, len);
                    const freq = prefixFrequency.get(prefix) || 0;
                    
                    // 如果这个前缀出现次数大于1，说明可能是主体
                    if (freq > 1) {
                        bestSubject = prefix;
                    } else {
                        // 频率<=1时停止，因为更长的前缀频率只会更低
                        break;
                    }
                }
                
                return bestSubject;
            }

            // 动作优先级（小的排前面）
            const ACTION_PRIORITIES = [
                '列表', '导出', '添加', '编辑', '删除'
            ];

            function actionPriority(title) {
                for (let i = 0; i < ACTION_PRIORITIES.length; i++) {
                    if (title.includes(ACTION_PRIORITIES[i])) {
                        return i;
                    }
                }
                return 999; // 其他动作优先级最低
            }

            // 1. 构建前缀频率表
            const allTitles = category.list.map(item => item.title);
            const prefixFrequency = buildPrefixFrequency(allTitles);
            
            console.log('前缀频率统计:', prefixFrequency);

            // 2. 统计所有"主体"
            const itemsWithSubject = category.list.map(item => {
                const subject = extractSubject(item.title, prefixFrequency);
                return {
                    ...item,
                    subject: subject,
                    actionPri: actionPriority(item.title)
                };
            });
            
            // 3. 主体出现次数计数
            const subjectCount = {};
            itemsWithSubject.forEach(item => {
                subjectCount[item.subject] = (subjectCount[item.subject] || 0) + 1;
            });

            console.log('主体统计:', subjectCount);

            // 4. 按主体分组
            const grouped = {};
            itemsWithSubject.forEach(item => {
                if (!grouped[item.subject]) grouped[item.subject] = [];
                grouped[item.subject].push(item);
            });
            
            // 5. 主体组名排序（主体名按出现频率降序，然后按拼音）
            const groupOrder = Object.keys(grouped)
                .sort();

            console.log('分组顺序:', groupOrder);

            // 6. 组内动作优先级+标题排序
            const sortedItems = [];
            for (const groupName of groupOrder) {
                const groupList = grouped[groupName];
                groupList.sort((a, b) => {
                    // 先按动作优先度，然后再 title 拼音
                    const actDiff = a.actionPri - b.actionPri;
                    if (actDiff !== 0) return actDiff;
                    return a.title.localeCompare(b.title, 'zh-CN');
                });
                sortedItems.push(...groupList);
            }

            const sortedList = sortedItems.map((item, index) => ({
                id: item._id,
                index: index
            }));

            console.log('排序后的接口列表:', sortedList);

            // 更新接口索引
            await updateInterfaceIndex(sortedList);

            window.location.reload();

        } catch (error) {
            console.error('排序失败:', error);
            alert(`排序失败: ${error.message}`);
        } finally {
            // 恢复按钮状态
            const button = liElement.querySelector('.yapi-sort-btn');
            if (button) {
                button.textContent = '排序';
                button.disabled = false;
            }
        }
    }

    // 为分类添加排序按钮
    function addSortButton(liElement) {
        // 检查是否已添加按钮
        if (liElement.querySelector('.yapi-sort-btn')) {
            return;
        }

        // 获取分类名称
        const contentWrapper = liElement.querySelector('.ant-tree-node-content-wrapper');
        if (!contentWrapper) {
            return;
        }

        const categoryName = contentWrapper.innerText.trim();

        // 创建排序按钮
        const sortButton = document.createElement('button');
        sortButton.className = 'yapi-sort-btn';
        sortButton.textContent = '排序';
        sortButton.style.cssText = `
            float:right;
            margin-left: 10px;
            padding: 1px 4px;
            font-size: 10px;
            background-color: #1890ff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            transition: background-color 0.3s;
        `;

        sortButton.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#40a9ff';
        });

        sortButton.addEventListener('mouseleave', function() {
            if (!this.disabled) {
                this.style.backgroundColor = '#1890ff';
            }
        });

        sortButton.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm(`确定要对"${categoryName}"分类下的接口按标题排序吗？`)) {
                sortInterfaces(categoryName, liElement);
            }
        });

        // 将按钮添加到 li 元素中
        contentWrapper.querySelector('.btns').insertBefore(sortButton, contentWrapper.querySelector('.btns').firstChild);
    }

    // 初始化：为所有分类添加按钮
    function initSortButtons() {
        const interfaceItems = document.querySelectorAll('.interface-item-nav');
        interfaceItems.forEach(item => {
            addSortButton(item);
        });
    }

    // 监听 DOM 变化，动态添加按钮
    function observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // 检查新添加的节点
                        if (node.classList && node.classList.contains('interface-item-nav')) {
                            addSortButton(node);
                        }
                        // 检查子节点
                        const items = node.querySelectorAll && node.querySelectorAll('.interface-item-nav');
                        if (items) {
                            items.forEach(item => addSortButton(item));
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 等待页面加载完成
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initSortButtons, 1000);
            });
        } else {
            setTimeout(initSortButtons, 1000);
        }

        // 启动 DOM 监听
        observeDOMChanges();
    }

    // 启动脚本
    init();

    console.log('YApi 接口自动排序脚本已加载');
})();

