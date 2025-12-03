// script.js - 货品管理账本主逻辑

// ========== 全局变量和初始化 ==========
let currentRecords = [];
let currentFilters = {};
let supabase = null;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// 初始化应用
function initApp() {
    // 获取Supabase客户端
    supabase = window.supabaseClient;
    
    // 初始化事件监听
    initEventListeners();
    
    // 初始化表单计算
    initFormCalculations();
    
    // 加载现有记录
    loadRecords();
    
    // 更新最后同步时间
    updateLastSyncTime();
    
    // 设置自动刷新（每30秒）
    setInterval(loadRecords, 30000);
}

// ========== 事件监听器初始化 ==========
function initEventListeners() {
    // 角色切换
    document.getElementById('roleSubmitBtn').addEventListener('click', () => switchRole('submit'));
    document.getElementById('roleViewBtn').addEventListener('click', () => switchRole('view'));
    
    // 表单相关
    document.getElementById('goodsForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    document.getElementById('calcShippingBtn').addEventListener('click', calculateShipping);
    
    // 查看记录相关
    document.getElementById('refreshBtn').addEventListener('click', loadRecords);
    document.getElementById('copyAllBtn').addEventListener('click', copyAllRecords);
    document.getElementById('filterBtn').addEventListener('click', toggleFilterPanel);
    
    // 筛选相关
    document.getElementById('closeFilterBtn').addEventListener('click', toggleFilterPanel);
    document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
    document.getElementById('clearFilterBtn').addEventListener('click', clearFilters);
    
    // 状态选择变化监听
    document.getElementById('status').addEventListener('change', handleStatusChange);
}

// ========== 角色切换 ==========
function switchRole(role) {
    const submitBtn = document.getElementById('roleSubmitBtn');
    const viewBtn = document.getElementById('roleViewBtn');
    const submitForm = document.getElementById('submitForm');
    const viewRecords = document.getElementById('viewRecords');
    
    if (role === 'submit') {
        submitBtn.classList.add('active');
        viewBtn.classList.remove('active');
        submitForm.classList.add('active');
        viewRecords.classList.remove('active');
    } else {
        submitBtn.classList.remove('active');
        viewBtn.classList.add('active');
        submitForm.classList.remove('active');
        viewRecords.classList.add('active');
        loadRecords();
    }
}

// ========== 表单计算逻辑 ==========
function initFormCalculations() {
    const unitPriceInput = document.getElementById('unitPrice');
    const quantityInput = document.getElementById('quantity');
    
    // 自动计算总价
    function calculateTotalCost() {
        const unitPrice = parseFloat(unitPriceInput.value) || 0;
        const quantity = parseInt(quantityInput.value) || 1;
        const totalCost = unitPrice * quantity;
        document.getElementById('totalCost').value = totalCost.toFixed(2);
        
        // 如果已经填写收入，重新计算利润
        if (document.getElementById('incomeSection').style.display !== 'none') {
            calculateProfit();
        }
    }
    
    unitPriceInput.addEventListener('input', calculateTotalCost);
    quantityInput.addEventListener('input', calculateTotalCost);
    
    // 初始计算
    calculateTotalCost();
}

// 运费计算
function calculateShipping() {
    const shippingExpr = document.getElementById('shippingExpr');
    const shippingFeeInput = document.getElementById('shippingFee');
    
    try {
        // 安全计算表达式（限制只允许数字和基本运算符）
        const expr = shippingExpr.value.replace(/[^0-9+\-*/().]/g, '');
        const result = Function('"use strict"; return (' + expr + ')')();
        
        if (isNaN(result) || !isFinite(result)) {
            throw new Error('计算结果无效');
        }
        
        const roundedResult = parseFloat(result.toFixed(2));
        shippingFeeInput.value = roundedResult;
        shippingExpr.value = roundedResult.toFixed(2);
        
        showMessage('运费计算成功: ' + roundedResult.toFixed(2) + '元', 'success');
        
        // 重新计算利润
        if (document.getElementById('incomeSection').style.display !== 'none') {
            calculateProfit();
        }
    } catch (error) {
        showMessage('请输入有效的算式，如: 3.68+3.68', 'error');
        shippingExpr.value = '';
        shippingFeeInput.value = '';
    }
}

// 利润计算
function calculateProfit() {
    const totalCost = parseFloat(document.getElementById('totalCost').value) || 0;
    const shippingFee = parseFloat(document.getElementById('shippingFee').value) || 0;
    const actualIncome = parseFloat(document.getElementById('actualIncome').value) || 0;
    const profit = actualIncome - totalCost - shippingFee;
    
    const profitDisplay = document.getElementById('profitDisplay');
    profitDisplay.value = profit.toFixed(2);
    
    // 设置颜色
    profitDisplay.classList.remove('positive', 'negative');
    if (profit > 0) {
        profitDisplay.classList.add('positive');
    } else if (profit < 0) {
        profitDisplay.classList.add('negative');
    }
}

// 处理状态变化
function handleStatusChange() {
    const status = document.getElementById('status').value;
    const incomeSection = document.getElementById('incomeSection');
    
    // 如果是卖出状态，显示收入与利润部分
    if (status.includes('已卖出')) {
        incomeSection.style.display = 'block';
        
        // 添加收入输入事件监听
        document.getElementById('actualIncome').addEventListener('input', calculateProfit);
        
        // 立即计算利润
        calculateProfit();
    } else {
        incomeSection.style.display = 'none';
    }
}

// ========== 表单提交处理 ==========
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // 验证表单
    if (!validateForm()) {
        return;
    }
    
    // 收集表单数据
    const formData = collectFormData();
    
    // 计算利润（如果是卖出状态）
    if (formData.status.includes('已卖出')) {
        const totalCost = parseFloat(document.getElementById('totalCost').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shippingFee').value) || 0;
        formData.profit = formData.actual_income - totalCost - shippingFee;
    } else {
        formData.profit = null;
    }
    
    // 显示提交中状态
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
    submitBtn.disabled = true;
    
    try {
        // 提交到Supabase
        const success = await submitToSupabase(formData);
        
        if (success) {
            showMessage('✅ 记录提交成功！数据已保存至云端。', 'success');
            resetForm();
            
            // 自动切换到查看模式
            setTimeout(() => switchRole('view'), 1500);
        } else {
            showMessage('❌ 提交失败，请检查网络连接。', 'error');
        }
    } catch (error) {
        console.error('提交错误:', error);
        showMessage('❌ 提交过程中发生错误: ' + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// 验证表单
function validateForm() {
    const goodsId = document.getElementById('goodsId').value.trim();
    const unitPrice = document.getElementById('unitPrice').value;
    const status = document.getElementById('status').value;
    const submitter = document.getElementById('submitter').value.trim();
    
    if (!goodsId) {
        showMessage('请输入货号', 'error');
        return false;
    }
    
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
        showMessage('请输入有效的拿货单价', 'error');
        return false;
    }
    
    if (status.includes('已卖出')) {
        const actualIncome = document.getElementById('actualIncome').value;
        if (!actualIncome || parseFloat(actualIncome) <= 0) {
            showMessage('卖出状态下必须填写实际收入', 'error');
            return false;
        }
    }
    
    if (!submitter) {
        showMessage('请输入提交人', 'error');
        return false;
    }
    
    return true;
}

// 收集表单数据
function collectFormData() {
    const shippingExpr = document.getElementById('shippingExpr').value;
    let shippingFee = document.getElementById('shippingFee').value;
    
    // 如果没有通过计算器计算，直接使用输入值
    if (!shippingFee && shippingExpr) {
        shippingFee = parseFloat(shippingExpr) || 0;
    }
    
    return {
        goods_id: document.getElementById('goodsId').value.trim(),
        unit_price: parseFloat(document.getElementById('unitPrice').value) || 0,
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        total_cost: parseFloat(document.getElementById('totalCost').value) || 0,
        status: document.getElementById('status').value,
        shipping_fee: parseFloat(shippingFee) || 0,
        shipping_note: document.getElementById('shippingNote').value.trim(),
        actual_income: status.includes('已卖出') ? 
            parseFloat(document.getElementById('actualIncome').value) || 0 : null,
        submitter: document.getElementById('submitter').value.trim(),
        created_at: new Date().toISOString()
    };
}

// 提交到Supabase
async function submitToSupabase(formData) {
    if (!supabase) {
        showMessage('❌ 数据库连接未初始化', 'error');
        return false;
    }
    
    try {
        const { data, error } = await supabase
            .from('goods_records')
            .insert([formData])
            .select();
        
        if (error) {
            throw error;
        }
        
        console.log('数据提交成功:', data);
        return true;
    } catch (error) {
        console.error('Supabase提交错误:', error);
        
        // 尝试错误处理
        if (error.message.includes('JWT')) {
            showMessage('❌ 数据库认证失败，请检查API密钥配置', 'error');
        } else if (error.message.includes('network')) {
            showMessage('❌ 网络连接失败，请检查网络设置', 'error');
        } else {
            showMessage('❌ 提交失败: ' + error.message, 'error');
        }
        
        return false;
    }
}

// 重置表单
function resetForm() {
    document.getElementById('goodsForm').reset();
    document.getElementById('totalCost').value = '0.00';
    document.getElementById('shippingExpr').value = '';
    document.getElementById('shippingFee').value = '';
    document.getElementById('profitDisplay').value = '';
    document.getElementById('incomeSection').style.display = 'none';
    
    // 触发总价计算
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
}

// ========== 记录查看与筛选 ==========
// 加载记录
async function loadRecords() {
    try {
        showLoading(true);
        
        let query = supabase
            .from('goods_records')
            .select('*')
            .order('created_at', { ascending: false });
        
        // 应用筛选条件
        if (currentFilters.goods_id) {
            query = query.ilike('goods_id', `%${currentFilters.goods_id}%`);
        }
        
        if (currentFilters.status) {
            query = query.eq('status', currentFilters.status);
        }
        
        if (currentFilters.submitter) {
            query = query.ilike('submitter', `%${currentFilters.submitter}%`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        currentRecords = data || [];
        displayRecords(currentRecords);
        updateStats(currentRecords);
        updateLastSyncTime();
        
        showMessage(`✅ 已加载 ${currentRecords.length} 条记录`, 'success');
        
    } catch (error) {
        console.error('加载记录错误:', error);
        showMessage('❌ 加载记录失败: ' + error.message, 'error');
        displayRecords([]);
    } finally {
        showLoading(false);
    }
}

// 显示记录
function displayRecords(records) {
    const recordsList = document.getElementById('recordsList');
    const emptyMessage = document.getElementById('emptyMessage');
    
    if (!records || records.length === 0) {
        recordsList.innerHTML = '';
        emptyMessage.style.display = 'block';
        return;
    }
    
    emptyMessage.style.display = 'none';
    
    let html = '';
    records.forEach(record => {
        const profit = record.profit !== null ? parseFloat(record.profit) : null;
        const profitClass = profit !== null ? 
            (profit > 0 ? 'positive' : profit < 0 ? 'negative' : '') : '';
        
        const profitText = profit !== null ? 
            `<div class="record-profit ${profitClass}">${profit.toFixed(2)} 元</div>` : '';
        
        const actualIncomeText = record.actual_income !== null ? 
            `<div class="record-field">
                <span class="record-label">实际收入:</span>
                <span class="record-value">${record.actual_income.toFixed(2)} 元</span>
            </div>` : '';
        
        const statusClass = record.status.includes('卖出') ? 'sold' : 
                           record.status.includes('退回') ? 'returned' : 'unsold';
        
        html += `
            <div class="record-item ${statusClass}">
                <div class="record-header">
                    <div class="record-title">${record.goods_id}</div>
                    <div class="record-status ${statusClass}">${record.status}</div>
                </div>
                
                <div class="record-body">
                    <div class="record-field">
                        <span class="record-label">拿货成本:</span>
                        <span class="record-value">${record.unit_price.toFixed(2)} 元 × ${record.quantity} = ${record.total_cost.toFixed(2)} 元</span>
                    </div>
                    
                    <div class="record-field">
                        <span class="record-label">运费:</span>
                        <span class="record-value">${record.shipping_fee.toFixed(2)} 元</span>
                    </div>
                    
                    ${actualIncomeText}
                    
                    ${profitText ? `
                    <div class="record-field">
                        <span class="record-label">利润:</span>
                        ${profitText}
                    </div>` : ''}
                    
                    <div class="record-field">
                        <span class="record-label">运费备注:</span>
                        <span class="record-value">${record.shipping_note || '无'}</span>
                    </div>
                </div>
                
                <div class="record-footer">
                    <span>提交人: ${record.submitter}</span>
                    <span>${formatDateTime(record.created_at)}</span>
                </div>
            </div>
        `;
    });
    
    recordsList.innerHTML = html;
}

// 更新统计信息
function updateStats(records) {
    const totalCount = document.getElementById('totalCount');
    const totalProfit = document.getElementById('totalProfit');
    
    totalCount.textContent = `共 ${records.length} 条记录`;
    
    // 计算总利润（只计算卖出记录）
    const soldRecords = records.filter(r => r.profit !== null);
    const profitSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.profit) || 0), 0);
    
    totalProfit.textContent = `总利润: ${profitSum.toFixed(2)} 元`;
    totalProfit.style.color = profitSum >= 0 ? '#2ecc71' : '#e74c3c';
}

// 复制所有记录
function copyAllRecords() {
    if (currentRecords.length === 0) {
        showMessage('没有可复制的记录', 'error');
        return;
    }
    
    // 构建表格格式文本
    let text = '货品管理记录汇总\n\n';
    text += '时间,货号,状态,单价,数量,总成本,运费,运费备注,实际收入,利润,提交人\n';
    
    currentRecords.forEach(record => {
        text += `${formatDateTime(record.created_at)},`;
        text += `${record.goods_id},`;
        text += `${record.status},`;
        text += `${record.unit_price.toFixed(2)},`;
        text += `${record.quantity},`;
        text += `${record.total_cost.toFixed(2)},`;
        text += `${record.shipping_fee.toFixed(2)},`;
        text += `${record.shipping_note || ''},`;
        text += `${record.actual_income ? record.actual_income.toFixed(2) : ''},`;
        text += `${record.profit ? record.profit.toFixed(2) : ''},`;
        text += `${record.submitter}\n`;
    });
    
    // 复制到剪贴板
    navigator.clipboard.writeText(text).then(() => {
        showMessage('✅ 所有记录已复制到剪贴板，可粘贴到Excel中', 'success');
        
        const copyBtn = document.getElementById('copyAllBtn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制！';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        showMessage('❌ 复制失败，请手动选择并复制', 'error');
    });
}

// ========== 筛选功能 ==========
function toggleFilterPanel() {
    const filterPanel = document.getElementById('filterPanel');
    filterPanel.classList.toggle('active');
}

function applyFilters() {
    currentFilters = {
        goods_id: document.getElementById('filterGoodsId').value.trim(),
        status: document.getElementById('filterStatus').value,
        submitter: document.getElementById('filterSubmitter').value.trim()
    };
    
    loadRecords();
    toggleFilterPanel();
    showMessage('筛选条件已应用', 'success');
}

function clearFilters() {
    document.getElementById('filterGoodsId').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSubmitter').value = '';
    
    currentFilters = {};
    loadRecords();
    showMessage('筛选条件已清除', 'success');
}

// ========== 工具函数 ==========
// 显示消息
function showMessage(text, type) {
    const messageBox = document.getElementById('formMessage');
    messageBox.textContent = text;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000);
}

// 显示/隐藏加载状态
function showLoading(show) {
    const refreshBtn = document.getElementById('refreshBtn');
    if (show) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
        refreshBtn.disabled = true;
    } else {
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新';
        refreshBtn.disabled = false;
    }
}

// 更新最后同步时间
function updateLastSyncTime() {
    const lastSync = document.getElementById('lastSync');
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    lastSync.textContent = `上次同步: ${timeString}`;
}

// 格式化日期时间
function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(/\//g, '-');
}