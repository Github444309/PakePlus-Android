console.log(
    '%cbuild from PakePlus： https://github.com/Sjj1024/PakePlus',
    'color:orangered;font-weight:bolder'
)

/**
 * PakePlus 增强功能包
 * 包含链接处理和密码管理两大核心功能
 */

// Password Manager Control - 密码管理器控制
class PasswordManagerControl {
    constructor(options = {}) {
        this.enabled = options.enabled !== false; // 默认启用密码保存
        this.selectors = options.selectors || [
            'input[type="password"]',
            'input[name*="password"]',
            'input[name*="pwd"]',
            'input[name*="pass"]'
        ];
        this.isObserving = false;
        this.observer = null;
        this.init();
    }

    init() {
        if (!this.enabled) {
            this.disablePasswordSaving();
        } else {
            this.enablePasswordSaving();
        }
        console.log(`Password manager ${this.enabled ? 'enabled' : 'disabled'}`);
    }

    // 禁用密码保存功能
    disablePasswordSaving() {
        // 方法1: 修改密码输入框的autocomplete属性
        this.updatePasswordFields((input) => {
            input.setAttribute('autocomplete', 'new-password'); // 比'off'更有效
            input.setAttribute('data-lpignore', 'true'); // LastPass忽略
            input.setAttribute('data-form-type', 'other'); // 1Password忽略
            input.setAttribute('autocapitalize', 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('spellcheck', 'false');
        });

        // 方法2: 动态监控新加入的表单元素
        this.startObserving();

        // 方法3: 防止表单提交时触发密码保存提示
        this.preventPasswordSavePrompt();
    }

    // 启用密码保存功能
    enablePasswordSaving() {
        this.stopObserving();
        
        this.updatePasswordFields((input) => {
            input.setAttribute('autocomplete', 'current-password');
            input.removeAttribute('data-lpignore');
            input.removeAttribute('data-form-type');
            input.removeAttribute('autocapitalize');
            input.removeAttribute('autocorrect');
            input.removeAttribute('spellcheck');
            
            // 恢复标准的name属性
            if (input.hasAttribute('data-original-name')) {
                input.name = input.getAttribute('data-original-name');
                input.removeAttribute('data-original-name');
            }
        });

        // 移除表单提交监听
        this.removeSubmitListener();
    }

    // 更新所有密码字段
    updatePasswordFields(callback) {
        try {
            this.selectors.forEach(selector => {
                const inputs = document.querySelectorAll(selector);
                inputs.forEach(input => {
                    try {
                        callback(input);
                    } catch (e) {
                        console.warn('Error updating password field:', e);
                    }
                });
            });
        } catch (error) {
            console.warn('Error in updatePasswordFields:', error);
        }
    }

    // 开始观察DOM变化
    startObserving() {
        if (this.isObserving) return;
        
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        this.processNewNode(node);
                    }
                });
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.isObserving = true;
    }

    // 停止观察DOM变化
    stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            this.isObserving = false;
        }
    }

    // 处理新添加的节点
    processNewNode(node) {
        if (!this.enabled) return;
        
        // 检查节点本身是否是密码输入框
        if (node.matches && this.selectors.some(selector => node.matches(selector))) {
            this.disableField(node);
        }
        
        // 检查节点内的密码输入框
        this.selectors.forEach(selector => {
            const inputs = node.querySelectorAll?.(selector) || [];
            inputs.forEach(input => this.disableField(input));
        });
    }

    // 禁用单个字段
    disableField(input) {
        if (!input.hasAttribute('data-pakeplus-processed')) {
            input.setAttribute('data-pakeplus-processed', 'true');
            input.setAttribute('autocomplete', 'new-password');
            input.setAttribute('data-lpignore', 'true');
            
            // 对动态生成的字段添加更强的保护
            if (input.name && input.name.toLowerCase().includes('password')) {
                input.setAttribute('data-original-name', input.name);
                setTimeout(() => {
                    if (input.isConnected) {
                        input.name = `pass_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    }
                }, 10);
            }
        }
    }

    // 防止密码保存提示
    preventPasswordSavePrompt() {
        this.removeSubmitListener();
        
        this.submitHandler = (e) => {
            if (!this.enabled) {
                // 创建一个隐藏的临时表单来干扰密码管理器
                const tempForm = document.createElement('form');
                tempForm.style.display = 'none';
                tempForm.innerHTML = `
                    <input type="text" name="username" value="temp">
                    <input type="password" name="password" value="temp">
                `;
                document.body.appendChild(tempForm);
                
                // 短暂延迟后移除临时表单
                setTimeout(() => {
                    if (tempForm.parentNode) {
                        tempForm.parentNode.removeChild(tempForm);
                    }
                }, 50);
            }
        };
        
        document.addEventListener('submit', this.submitHandler, true);
    }

    // 移除表单提交监听
    removeSubmitListener() {
        if (this.submitHandler) {
            document.removeEventListener('submit', this.submitHandler, true);
            this.submitHandler = null;
        }
    }

    // 切换密码保存状态
    toggle(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.enablePasswordSaving();
        } else {
            this.disablePasswordSaving();
        }
        return this.enabled;
    }

    // 销毁实例
    destroy() {
        this.stopObserving();
        this.removeSubmitListener();
        this.enablePasswordSaving(); // 恢复到默认状态
    }
}

// 初始化密码管理器控制
const passwordManager = new PasswordManagerControl({
    enabled: true, // 设为false可禁用密码保存
});

// very important, if you don't know what it is, don't touch it
// 非常重要，不懂代码不要动，这里可以解决80%的问题，也可以生产1000+的bug
const hookClick = (e) => {
    try {
        const origin = e.target.closest('a');
        const isBaseTargetBlank = document.querySelector(
            'head base[target="_blank"]'
        );
        
        if (
            (origin && origin.href && origin.target === '_blank') ||
            (origin && origin.href && isBaseTargetBlank)
        ) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Redirecting instead of opening new window:', origin.href);
            location.href = origin.href;
        }
    } catch (error) {
        console.warn('Error in hookClick:', error);
    }
}

// 重写window.open
const originalWindowOpen = window.open;
window.open = function (url, target, features) {
    console.log('Intercepted window.open:', url);
    
    if (url && typeof url === 'string' && 
        (url.startsWith('http:') || url.startsWith('https:') ||') || url.startsWith('/'))) {
        location.href = url;
        return null;
    }
    
    // 对于非URL情况，调用原始方法
    return originalWindowOpen.call(this, url, target, features);
}

// 事件监听
document.addEventListener('click', hookClick, { 
    capture: true,
    passive: false 
});

// 导出到全局，便于调试和控制
window.PakePlus = {
    // 密码管理功能
    passwordManager: {
        enable: () => passwordManager.toggle(true),
        disable: () => passwordManager.toggle(false),
        toggle: (state) => passwordManager.toggle(state),
        getState: () => passwordManager.enabled
    },
    
    // 链接处理功能
    linkHandler: {
        disable: () => {
            document.removeEventListener('click', hookClick, true);
        },
        enable: () => {
            document.addEventListener('click', hookClick, { 
                capture: true,
                passive: false 
            });
        }
    },
    
    // 工具函数
    utils: {
        reload: () => location.reload(),
        version: '1.1.0'
    }
};

console.log('%cPakePlus initialized successfully!', 'color:green;font-weight:bold');
console.log('%cFeatures: Link handling + Password manager control', 'color:blue;font-weight:bold');

// 页面加载完成后重新扫描一次密码字段
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            passwordManager.init();
        }, 100);
    });
} else {
    setTimeout(() => {
        passwordManager.init();
    }, 100);
}