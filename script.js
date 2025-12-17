// Supabase配置 - 需要替换为你的实际配置
const SUPABASE_URL = 'https://gbsqrtaooovsxnwftkbk.supabase.co'; // 替换为你的Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic3FydGFvb292c3hud2Z0a2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjM3ODcsImV4cCI6MjA4MDMzOTc4N30.FKUrAR1qr5bSNEJMomU24aYFDK-fep3eNjZY1n8QgN4'; // 替换为你的Supabase anon public key

// 初始化Supabase客户端
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全局状态
let currentView = 'partner';
let goodsHistory = [];
let allRecords = [];

// DOM元素缓存
const elements = {
    // 角色切换
    roleOptions: document.querySelectorAll('.role-option'),
    partnerView: document.getElementById('partner-view'),
    accountantView: document.getElementById('accountant-view'),
    
    // 表单元素
    goodsForm: document.getElementById('goods-form'),
    goodsIdInput: document.getElementById('goods-id'),
    goodsNameInput: document.getElementById('goods-name'),
    unitPriceInput: document.getElementById('unit-price'),
    quantityInput: document.getElementById('quantity'),
    shippingFeeInput: document.getElementById('shipping-fee'),
    actualIncomeInput: document.getElementById('actual-income'),
    remarkInput: document.getElementById('remark'),
    submitterInput: document.getElementById('submitter'),
    statusInput: document.getElementById('status'),
    statusOptions: document.querySelectorAll('.status-option'),
    shippingNoteInput: document.getElementById('shipping-note'),
    
    // 显示元素
    totalCostDisplay: document.getElementById('total-cost-display'),
    profitDisplay: document.getElementById('profit-display'),
    incomeBreakdown: document.getElementById('income-breakdown'),
    costBreakdown: document.getElementById('cost-breakdown'),
    shippingBreakdown: document.getElementById('shipping-breakdown'),
    shippingFeePreview: document.getElementById('shipping-fee-preview'),
    suggestions: document.getElementById('suggestions'),
    
    // 按钮
    resetFormBtn: document.getElementById('reset-form'),
    applyFiltersBtn: document.getElementById('apply-filters'),
    resetFiltersBtn: document.getElementById('reset-filters'),
    exportDataBtn: document.getElementById('export-data'),
    refreshDataBtn: document.getElementById('refresh-data'),
    
    // 筛选元素
    timeFilterTabs: document.querySelectorAll('.time-tab'),
    goodsIdFilter: document.getElementById('goods-id-filter'),
    submitterFilter: document.getElementById('submitter-filter'),
    statusFilter: document.getElementById('status-filter'),
    viewModeSelect: document.getElementById('view-mode'),
    dateFromInput: document.getElementById('date-from'),
    dateToInput: document.getElementById('date-to'),
    
    // 统计元素
    totalRecordsEl: document.getElementById('total-records'),
    totalProfitEl: document.getElementById('total-profit'),
    totalCostSumEl: document.getElementById('total-cost-sum'),
    avgProfitMarginEl: document.getElementById('avg-profit-margin'),
    liveRecordCount: document.getElementById('live-record-count'),
    liveProfitToday: document.getElementById('live-profit-today'),
    
    // 其他
    lastSync: document.getElementById('last-sync'),
    notification: document.getElementById('notification'),
    formMessage: document.getElementById('form-message'),
    recordsTable: document.getElementById('records-table')
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    initializeApp();
    setupEventListeners();
    
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    elements.dateFromInput.value = today;
    elements.dateToInput.value = today;
    
    // 加载数据
    await loadGoodsHistory();
    await loadRecords();
    
    // 更新实时统计
    updateLiveStats();
    
    // 如果是测试模式，显示提示
    if (SUPABASE_URL.includes('your-project') || SUPABASE_ANON_KEY.includes('your-anon-key')) {
        showNotification('测试模式', '当前使用本地存储模式，请配置Supabase获得完整功能', 'warning');
    }
});

// 初始化应用
function initializeApp() {
    // 设置动画延迟
    document.querySelectorAll('.form-section').forEach((section, index) => {
        section.style.setProperty('--i', index);
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 角色切换
    elements.roleOptions.forEach(option => {
        option.addEventListener('click', () => {
            const role = option.dataset.role;
            switchView(role);
        });
    });

    // 合伙人视图事件
    setupPartnerViewListeners();
    
    // 记账人视图事件
    setupAccountantViewListeners();
    
    // 表单提交
    elements.goodsForm.addEventListener('submit', handleFormSubmit);
    
    // 重置表单
    elements.resetFormBtn.addEventListener('click', resetForm);
    
    // 应用筛选
    elements.applyFiltersBtn.addEventListener('click', loadRecords);
    
    // 重置筛选
    elements.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // 导出数据
    elements.exportDataBtn.addEventListener('click', exportData);
    
    // 刷新数据
    elements.refreshDataBtn.addEventListener('click', () => {
        loadRecords();
        showNotification('数据刷新', '数据已成功刷新', 'success');
    });
    
    // 时间筛选标签
    elements.timeFilterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.timeFilterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const range = tab.dataset.range;
            const customRange = document.getElementById('custom-date-range');
            customRange.classList.toggle('hidden', range !== 'custom');
            
            if (range !== 'custom') {
                loadRecords();
            }
        });
    });
}

// 设置合伙人视图事件监听
function setupPartnerViewListeners() {
    // 状态选项选择
    elements.statusOptions.forEach(option => {
        option.addEventListener('click', function() {
            // 移除其他选项的激活状态
            elements.statusOptions.forEach(opt => opt.classList.remove('active'));
            
            // 设置当前选项为激活状态
            this.classList.add('active');
            
            // 更新隐藏的输入框值
            elements.statusInput.value = this.dataset.value;
            
            // 检查是否为卖出状态
            const isSoldStatus = this.dataset.value.includes('已卖出');
            const soldFields = document.getElementById('sold-fields');
            
            if (isSoldStatus) {
                soldFields.classList.remove('hidden');
                elements.actualIncomeInput.required = true;
                calculateProfit(); // 立即计算利润
            } else {
                soldFields.classList.add('hidden');
                elements.actualIncomeInput.required = false;
                elements.actualIncomeInput.value = '';
                updateProfitDisplay(0);
            }
        });
    });

    // 智能货号搜索
    elements.goodsIdInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length >= 2) {
            showGoodsSuggestions(query);
        } else {
            hideSuggestions();
        }
    });

    // 计算总价
    elements.unitPriceInput.addEventListener('input', calculateTotalCost);
    elements.quantityInput.addEventListener('input', calculateTotalCost);
    
    // 运费实时计算
    elements.shippingFeeInput.addEventListener('input', function() {
        const fee = calculateShippingFee();
        updateShippingFeePreview(fee);
        
        if (elements.statusInput.value.includes('已卖出')) {
            calculateProfit();
        }
    });
    
    // 实际收入变化计算利润
    elements.actualIncomeInput.addEventListener('input', calculateProfit);
    
    // 点击外部关闭建议框
    document.addEventListener('click', function(e) {
        if (!elements.goodsIdInput.contains(e.target) && 
            !elements.suggestions.contains(e.target)) {
            hideSuggestions();
        }
    });
}

// 设置记账人视图事件监听
function setupAccountantViewListeners() {
    // 自定义日期范围变化
    elements.dateFromInput.addEventListener('change', () => {
        if (document.querySelector('.time-tab.active').dataset.range === 'custom') {
            loadRecords();
        }
    });
    
    elements.dateToInput.addEventListener('change', () => {
        if (document.querySelector('.time-tab.active').dataset.range === 'custom') {
            loadRecords();
        }
    });
    
    // 视图模式变化
    elements.viewModeSelect.addEventListener('change', loadRecords);
}

// 切换视图
function switchView(view) {
    currentView = view;
    
    // 更新角色选项状态
    elements.roleOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.role === view);
    });
    
    // 切换视图显示
    elements.partnerView.classList.toggle('active-view', view === 'partner');
    elements.accountantView.classList.toggle('active-view', view === 'accountant');
    
    // 如果是记账人视图，刷新数据
    if (view === 'accountant') {
        loadRecords();
        updateLiveStats();
    }
}

// 显示商品建议
function showGoodsSuggestions(query) {
    const filtered = goodsHistory.filter(item =>
        item.goods_id.toLowerCase().includes(query.toLowerCase()) ||
        item.goods_name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    
    if (filtered.length === 0) {
        hideSuggestions();
        return;
    }
    
    elements.suggestions.innerHTML = filtered.map(item => `
        <div class="suggestion-item" data-goods-id="${item.goods_id}" 
             data-goods-name="${item.goods_name}" data-unit-price="${item.unit_price}">
            <i class="fas fa-box suggestion-icon"></i>
            <div>
                <div class="suggestion-title">${item.goods_id} - ${item.goods_name}</div>
                <div class="suggestion-subtitle">最近单价: ¥${item.unit_price.toFixed(2)}</div>
            </div>
        </div>
    `).join('');
    
    elements.suggestions.classList.add('active');
    
    // 添加点击事件
    elements.suggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', function() {
            const goodsId = this.dataset.goodsId;
            const goodsName = this.dataset.goodsName;
            const unitPrice = this.dataset.unitPrice;
            
            elements.goodsIdInput.value = goodsId;
            elements.goodsNameInput.value = goodsName;
            elements.unitPriceInput.value = unitPrice;
            
            hideSuggestions();
            calculateTotalCost();
            
            // 触发输入事件以显示其他可能的相关信息
            elements.goodsIdInput.dispatchEvent(new Event('input'));
        });
    });
}

// 隐藏建议框
function hideSuggestions() {
    elements.suggestions.classList.remove('active');
    elements.suggestions.innerHTML = '';
}

// 计算总价
function calculateTotalCost() {
    const unitPrice = parseFloat(elements.unitPriceInput.value) || 0;
    const quantity = parseInt(elements.quantityInput.value) || 1;
    const totalCost = unitPrice * quantity;
    
    elements.totalCostDisplay.textContent = `¥${totalCost.toFixed(2)}`;
    
    // 更新利润计算的成本部分
    updateCostBreakdown(totalCost);
    
    if (elements.statusInput.value.includes('已卖出')) {
        calculateProfit();
    }
    
    return totalCost;
}

// 计算运费
function calculateShippingFee() {
    const feeExpression = elements.shippingFeeInput.value.trim();
    
    if (!feeExpression) {
        return 0;
    }
    
    try {
        // 安全地计算数学表达式，只允许基本算术运算
        const sanitized = feeExpression.replace(/[^-()\d/*+.\s]/g, '');
        const fee = eval(sanitized);
        return isNaN(fee) ? 0 : parseFloat(fee.toFixed(2));
    } catch (error) {
        return 0;
    }
}

// 更新运费预览
function updateShippingFeePreview(fee) {
    const preview = elements.shippingFeePreview.querySelector('span');
    preview.textContent = fee.toFixed(2);
    
    // 根据运费值添加视觉反馈
    if (fee > 10) {
        elements.shippingFeePreview.style.background = 'rgba(248, 150, 30, 0.1)';
        elements.shippingFeePreview.style.color = 'var(--warning-color)';
    } else {
        elements.shippingFeePreview.style.background = '';
        elements.shippingFeePreview.style.color = '';
    }
    
    updateShippingBreakdown(fee);
    return fee;
}

// 计算利润
function calculateProfit() {
    const totalCost = parseFloat(elements.unitPriceInput.value || 0) * parseInt(elements.quantityInput.value || 1);
    const shippingFee = calculateShippingFee();
    const actualIncome = parseFloat(elements.actualIncomeInput.value) || 0;
    
    const profit = actualIncome - totalCost - shippingFee;
    updateProfitDisplay(profit);
    
    return profit;
}

// 更新利润显示
function updateProfitDisplay(profit) {
    const profitAmount = elements.profitDisplay.querySelector('.profit-amount');
    const profitTrend = elements.profitDisplay.querySelector('.profit-trend');
    const profitIcon = profitTrend.querySelector('i');
    const profitPercent = profitTrend.querySelector('span');
    
    profitAmount.textContent = `¥${profit.toFixed(2)}`;
    
    // 计算利润率
    const totalCost = parseFloat(elements.unitPriceInput.value || 0) * parseInt(elements.quantityInput.value || 1);
    const actualIncome = parseFloat(elements.actualIncomeInput.value) || 0;
    const margin = actualIncome > 0 ? (profit / actualIncome * 100) : 0;
    
    profitPercent.textContent = `${margin.toFixed(1)}%`;
    
    // 根据利润正负设置样式
    if (profit > 0) {
        profitAmount.style.color = 'var(--success-color)';
        profitTrend.style.color = 'var(--success-color)';
        profitIcon.className = 'fas fa-arrow-up';
        profitTrend.classList.add('positive');
        profitTrend.classList.remove('negative');
    } else if (profit < 0) {
        profitAmount.style.color = 'var(--danger-color)';
        profitTrend.style.color = 'var(--danger-color)';
        profitIcon.className = 'fas fa-arrow-down';
        profitTrend.classList.add('negative');
        profitTrend.classList.remove('positive');
    } else {
        profitAmount.style.color = 'var(--gray-700)';
        profitTrend.style.color = 'var(--gray-700)';
        profitIcon.className = 'fas fa-minus';
        profitTrend.classList.remove('positive', 'negative');
    }
}

// 更新成本分解
function updateCostBreakdown(cost) {
    elements.costBreakdown.textContent = `¥${cost.toFixed(2)}`;
}

// 更新运费分解
function updateShippingBreakdown(fee) {
    elements.shippingBreakdown.textContent = `¥${fee.toFixed(2)}`;
}

// 加载商品历史记录
async function loadGoodsHistory() {
    try {
        const { data, error } = await supabase
            .from('goods_records')
            .select('goods_id, goods_name, unit_price')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (data) {
            goodsHistory = data;
            
            // 去重，只保留每个货号的最新记录
            const uniqueMap = new Map();
            data.forEach(item => {
                if (!uniqueMap.has(item.goods_id)) {
                    uniqueMap.set(item.goods_id, item);
                }
            });
            
            goodsHistory = Array.from(uniqueMap.values());
            localStorage.setItem('goods_history', JSON.stringify(goodsHistory));
        }
    } catch (error) {
        console.error('加载商品历史失败:', error);
        
        // 尝试从本地存储加载
        const localHistory = localStorage.getItem('goods_history');
        if (localHistory) {
            goodsHistory = JSON.parse(localHistory);
        }
    }
}

// 处理表单提交
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // 显示加载状态
    const submitBtn = e.target.querySelector('.btn-primary');
    const loader = submitBtn.querySelector('.submit-loader');
    loader.classList.remove('hidden');
    submitBtn.disabled = true;
    
    try {
        // 收集表单数据
        const formData = {
            goods_id: elements.goodsIdInput.value.trim(),
            goods_name: elements.goodsNameInput.value.trim(),
            unit_price: parseFloat(elements.unitPriceInput.value),
            quantity: parseInt(elements.quantityInput.value),
            total_cost: parseFloat(elements.unitPriceInput.value) * parseInt(elements.quantityInput.value),
            status: elements.statusInput.value,
            shipping_fee: calculateShippingFee(),
            shipping_note: elements.shippingNoteInput.value.trim(),
            actual_income: elements.statusInput.value.includes('已卖出') ? 
                          parseFloat(elements.actualIncomeInput.value) : null,
            profit: elements.statusInput.value.includes('已卖出') ? 
                   calculateProfit() : null,
            remark: elements.remarkInput.value.trim(),
            submitter: elements.submitterInput.value.trim() || null,
            created_at: new Date().toISOString()
        };
        
        // 验证必填字段
        if (!formData.goods_id || !formData.goods_name || !formData.unit_price || 
            !formData.status || isNaN(formData.shipping_fee)) {
            throw new Error('请填写所有必填字段');
        }
        
        // 如果是卖出状态，验证实际收入
        if (formData.status.includes('已卖出') && 
            (formData.actual_income === null || isNaN(formData.actual_income))) {
            throw new Error('卖出状态必须填写实际收入');
        }
        
        // 插入数据到Supabase
        const { data, error } = await supabase
            .from('goods_records')
            .insert([formData])
            .select();
        
        if (error) throw error;
        
        // 提交成功
        showNotification('提交成功', '货品记录已成功提交到系统', 'success');
        
        // 重置表单
        resetForm();
        
        // 重新加载历史记录
        await loadGoodsHistory();
        
        // 更新实时统计
        updateLiveStats();
        
        // 如果当前是记账人视图，刷新数据
        if (currentView === 'accountant') {
            await loadRecords();
        }
        
    } catch (error) {
        console.error('提交记录失败:', error);
        showNotification('提交失败', error.message, 'error');
    } finally {
        // 恢复按钮状态
        const submitBtn = e.target.querySelector('.btn-primary');
        const loader = submitBtn.querySelector('.submit-loader');
        loader.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

// 重置表单
function resetForm() {
    elements.goodsForm.reset();
    elements.quantityInput.value = 1;
    document.getElementById('sold-fields').classList.add('hidden');
    elements.statusInput.value = '';
    
    // 重置状态选项
    elements.statusOptions.forEach(opt => opt.classList.remove('active'));
    
    // 重置显示
    elements.totalCostDisplay.textContent = '¥0.00';
    updateProfitDisplay(0);
    updateShippingFeePreview(0);
    updateCostBreakdown(0);
    updateShippingBreakdown(0);
    elements.incomeBreakdown.textContent = '¥0.00';
    
    // 隐藏消息
    elements.formMessage.classList.add('hidden');
    
    showNotification('表单重置', '所有表单字段已重置', 'info');
}

// 加载记录数据
async function loadRecords() {
    // 显示加载状态
    elements.recordsTable.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <div class="spinner-circle"></div>
            </div>
            <p>正在加载数据...</p>
        </div>
    `;
    
    try {
        // 构建查询
        let query = supabase.from('goods_records').select('*');
        
        // 应用时间筛选
        const activeTimeTab = document.querySelector('.time-tab.active');
        const timeRange = activeTimeTab?.dataset.range || 'today';
        
        if (timeRange !== 'all') {
            let startDate, endDate;
            const now = new Date();
            
            switch (timeRange) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 1);
                    break;
                case 'week':
                    const dayOfWeek = now.getDay();
                    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 7);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear() + 1, 0, 1);
                    break;
                case 'custom':
                    const dateFrom = elements.dateFromInput.value;
                    const dateTo = elements.dateToInput.value;
                    if (dateFrom && dateTo) {
                        startDate = new Date(dateFrom);
                        endDate = new Date(dateTo);
                        endDate.setDate(endDate.getDate() + 1);
                    }
                    break;
            }
            
            if (startDate && endDate) {
                query = query.gte('created_at', startDate.toISOString())
                            .lt('created_at', endDate.toISOString());
            }
        }
        
        // 应用其他筛选
        const goodsIdFilter = elements.goodsIdFilter.value.trim();
        if (goodsIdFilter) {
            query = query.ilike('goods_id', `%${goodsIdFilter}%`);
        }
        
        const statusFilter = elements.statusFilter.value;
        if (statusFilter !== 'all') {
            if (statusFilter === '已卖出') {
                query = query.like('status', '已卖出%');
            } else {
                query = query.eq('status', statusFilter);
            }
        }
        
        const submitterFilter = elements.submitterFilter.value.trim();
        if (submitterFilter) {
            query = query.ilike('submitter', `%${submitterFilter}%`);
        }
        
        // 按时间倒序排序
        query = query.order('created_at', { ascending: false });
        
        // 执行查询
        const { data, error } = await query;
        
        if (error) throw error;
        
        // 保存记录到全局变量
        allRecords = data || [];
        
        // 更新统计数据
        updateStatistics(allRecords);
        
        // 根据视图模式显示数据
        const viewMode = elements.viewModeSelect.value;
        displayRecords(allRecords, viewMode);
        
        // 更新最后同步时间
        updateLastSyncTime();
        
    } catch (error) {
        console.error('加载记录失败:', error);
        elements.recordsTable.innerHTML = `
            <div class="loading-state" style="color: var(--danger-color);">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem;"></i>
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

// 更新统计数据
function updateStatistics(records) {
    if (!records || records.length === 0) {
        elements.totalRecordsEl.textContent = '0';
        elements.totalProfitEl.textContent = '¥0';
        elements.totalCostSumEl.textContent = '¥0';
        elements.avgProfitMarginEl.textContent = '0%';
        return;
    }
    
    const totalRecords = records.length;
    
    // 计算总利润（只计算卖出状态）
    const soldRecords = records.filter(r => r.status.includes('已卖出') && r.profit !== null);
    const totalProfit = soldRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
    
    // 计算总成本
    const totalCostSum = records.reduce((sum, record) => sum + (record.total_cost || 0), 0);
    
    // 计算平均利润率
    const totalRevenue = soldRecords.reduce((sum, record) => sum + (record.actual_income || 0), 0);
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
    
    // 更新显示
    elements.totalRecordsEl.textContent = totalRecords.toLocaleString();
    elements.totalProfitEl.textContent = `¥${totalProfit.toFixed(2)}`;
    elements.totalProfitEl.style.color = totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    elements.totalCostSumEl.textContent = `¥${totalCostSum.toFixed(2)}`;
    elements.avgProfitMarginEl.textContent = `${avgProfitMargin.toFixed(1)}%`;
    elements.avgProfitMarginEl.style.color = avgProfitMargin >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
}

// 显示记录数据
function displayRecords(records, viewMode) {
    if (records.length === 0) {
        elements.recordsTable.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-500);"></i>
                <p>暂无数据</p>
                <p style="color: var(--gray-600); font-size: 0.9rem;">尝试调整筛选条件</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    switch (viewMode) {
        case 'timeline':
            html = createTimelineView(records);
            break;
        case 'grouped':
            html = createGroupedView(records);
            break;
        case 'monthly':
            html = createMonthlyView(records);
            break;
        case 'table':
        default:
            html = createTableView(records);
    }
    
    elements.recordsTable.innerHTML = html;
    
    // 添加交互效果
    setTimeout(() => {
        document.querySelectorAll('.table-row, .month-card, .goods-group').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 100);
        });
    }, 10);
}

// 创建时间线视图
function createTimelineView(records) {
    let html = `
        <div class="table-container">
            <table>
                <thead>
                    <tr class="table-header-row">
                        <th class="table-header-cell">时间</th>
                        <th class="table-header-cell">货号</th>
                        <th class="table-header-cell">尺码/款式</th>
                        <th class="table-header-cell">状态</th>
                        <th class="table-header-cell">成本</th>
                        <th class="table-header-cell">收入</th>
                        <th class="table-header-cell">利润</th>
                        <th class="table-header-cell">提交人</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    records.forEach(record => {
        const date = new Date(record.created_at);
        const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let statusClass = '';
        if (record.status.includes('已卖出')) statusClass = 'sold';
        else if (record.status.includes('退回')) statusClass = 'returned';
        else statusClass = 'unsold';
        
        const profitClass = record.profit >= 0 ? 'positive' : 'negative';
        
        html += `
            <tr class="table-row">
                <td class="table-cell">${timeStr}</td>
                <td class="table-cell"><strong>${record.goods_id}</strong></td>
                <td class="table-cell">${record.goods_name}</td>
                <td class="table-cell">
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${statusClass === 'sold' ? 'fa-check-circle' : statusClass === 'returned' ? 'fa-undo' : 'fa-box'}"></i>
                        ${record.status}
                    </span>
                </td>
                <td class="table-cell">¥${record.total_cost?.toFixed(2) || '0.00'}</td>
                <td class="table-cell">${record.actual_income ? '¥' + record.actual_income.toFixed(2) : '-'}</td>
                <td class="table-cell profit-cell ${profitClass}">
                    ${record.profit !== null ? '¥' + record.profit.toFixed(2) : '-'}
                </td>
                <td class="table-cell">${record.submitter || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
}

// 创建按货号分组视图
function createGroupedView(records) {
    // 按货号分组
    const grouped = {};
    records.forEach(record => {
        if (!grouped[record.goods_id]) {
            grouped[record.goods_id] = [];
        }
        grouped[record.goods_id].push(record);
    });
    
    let html = '<div class="grouped-records">';
    
    Object.entries(grouped).forEach(([goodsId, goodsRecords]) => {
        const firstRecord = goodsRecords[0];
        
        // 计算该货号的统计
        const totalCost = goodsRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
        const totalIncome = goodsRecords.filter(r => r.status.includes('已卖出'))
                                       .reduce((sum, r) => sum + (r.actual_income || 0), 0);
        const totalProfit = goodsRecords.filter(r => r.status.includes('已卖出'))
                                       .reduce((sum, r) => sum + (r.profit || 0), 0);
        
        html += `
            <div class="goods-group">
                <div class="group-header">
                    <span>${goodsId} - ${firstRecord.goods_name}</span>
                    <span>${goodsRecords.length} 条记录</span>
                </div>
                <div class="group-records">
                    <div class="group-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div style="text-align: center;">
                            <div style="font-size: 0.8rem; color: var(--gray-600);">总成本</div>
                            <div style="font-weight: 600; color: var(--warning-color);">¥${totalCost.toFixed(2)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 0.8rem; color: var(--gray-600);">总收入</div>
                            <div style="font-weight: 600; color: var(--primary-color);">¥${totalIncome.toFixed(2)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 0.8rem; color: var(--gray-600);">总利润</div>
                            <div style="font-weight: 600; color: ${totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">¥${totalProfit.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr class="table-header-row">
                                    <th class="table-header-cell">时间</th>
                                    <th class="table-header-cell">状态</th>
                                    <th class="table-header-cell">单价</th>
                                    <th class="table-header-cell">数量</th>
                                    <th class="table-header-cell">总成本</th>
                                    <th class="table-header-cell">收入</th>
                                    <th class="table-header-cell">利润</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        goodsRecords.forEach(record => {
            const date = new Date(record.created_at);
            const timeStr = `${date.getMonth()+1}/${date.getDate()}`;
            const profitClass = record.profit >= 0 ? 'positive' : 'negative';
            
            html += `
                <tr class="table-row">
                    <td class="table-cell">${timeStr}</td>
                    <td class="table-cell">${record.status}</td>
                    <td class="table-cell">¥${record.unit_price?.toFixed(2) || '0.00'}</td>
                    <td class="table-cell">${record.quantity || 1}</td>
                    <td class="table-cell">¥${record.total_cost?.toFixed(2) || '0.00'}</td>
                    <td class="table-cell">${record.actual_income ? '¥' + record.actual_income.toFixed(2) : '-'}</td>
                    <td class="table-cell profit-cell ${profitClass}">
                        ${record.profit !== null ? '¥' + record.profit.toFixed(2) : '-'}
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div></div></div>';
    });
    
    html += '</div>';
    return html;
}

// 创建按月汇总视图
function createMonthlyView(records) {
    // 按月分组
    const monthly = {};
    records.forEach(record => {
        const date = new Date(record.created_at);
        const monthKey = `${date.getFullYear()}年${(date.getMonth()+1).toString().padStart(2, '0')}月`;
        
        if (!monthly[monthKey]) {
            monthly[monthKey] = {
                records: [],
                totalCost: 0,
                totalIncome: 0,
                totalProfit: 0,
                soldCount: 0,
                totalCount: 0
            };
        }
        
        monthly[monthKey].records.push(record);
        monthly[monthKey].totalCost += record.total_cost || 0;
        monthly[monthKey].totalCount++;
        
        if (record.status.includes('已卖出')) {
            monthly[monthKey].totalIncome += record.actual_income || 0;
            monthly[monthKey].totalProfit += record.profit || 0;
            monthly[monthKey].soldCount++;
        }
    });
    
    let html = '<div class="monthly-stats">';
    
    // 按月排序（从新到旧）
    const months = Object.entries(monthly).sort((a, b) => {
        // 提取年份和月份进行比较
        const [yearA, monthA] = a[0].match(/\d+/g).map(Number);
        const [yearB, monthB] = b[0].match(/\d+/g).map(Number);
        
        if (yearA !== yearB) return yearB - yearA;
        return monthB - monthA;
    });
    
    months.forEach(([monthKey, data]) => {
        const profitMargin = data.totalIncome > 0 ? (data.totalProfit / data.totalIncome * 100) : 0;
        const profitClass = data.totalProfit >= 0 ? 'profit-positive' : 'profit-negative';
        
        html += `
            <div class="month-card">
                <div class="month-header">
                    <div class="month-title">${monthKey}</div>
                    <div class="month-total ${profitClass}">¥${data.totalProfit.toFixed(2)}</div>
                </div>
                <div class="month-details">
                    <div class="month-detail">
                        <div class="detail-label">总记录数</div>
                        <div class="detail-value">${data.totalCount}</div>
                    </div>
                    <div class="month-detail">
                        <div class="detail-label">卖出数量</div>
                        <div class="detail-value">${data.soldCount}</div>
                    </div>
                    <div class="month-detail">
                        <div class="detail-label">总成本</div>
                        <div class="detail-value">¥${data.totalCost.toFixed(2)}</div>
                    </div>
                    <div class="month-detail">
                        <div class="detail-label">总收入</div>
                        <div class="detail-value">¥${data.totalIncome.toFixed(2)}</div>
                    </div>
                    <div class="month-detail">
                        <div class="detail-label">利润率</div>
                        <div class="detail-value ${profitClass}">${profitMargin.toFixed(1)}%</div>
                    </div>
                    <div class="month-detail">
                        <div class="detail-label">平均利润</div>
                        <div class="detail-value ${profitClass}">
                            ¥${data.soldCount > 0 ? (data.totalProfit / data.soldCount).toFixed(2) : '0.00'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// 创建详细表格视图
function createTableView(records) {
    let html = `
        <div class="table-container">
            <table>
                <thead>
                    <tr class="table-header-row">
                        <th class="table-header-cell">时间</th>
                        <th class="table-header-cell">货号</th>
                        <th class="table-header-cell">尺码/款式</th>
                        <th class="table-header-cell">单价</th>
                        <th class="table-header-cell">数量</th>
                        <th class="table-header-cell">总价</th>
                        <th class="table-header-cell">状态</th>
                        <th class="table-header-cell">运费</th>
                        <th class="table-header-cell">收入</th>
                        <th class="table-header-cell">利润</th>
                        <th class="table-header-cell">提交人</th>
                        <th class="table-header-cell">备注</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    records.forEach(record => {
        const date = new Date(record.created_at);
        const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let statusClass = '';
        if (record.status.includes('已卖出')) statusClass = 'sold';
        else if (record.status.includes('退回')) statusClass = 'returned';
        else statusClass = 'unsold';
        
        const profitClass = record.profit >= 0 ? 'positive' : 'negative';
        
        html += `
            <tr class="table-row">
                <td class="table-cell">${timeStr}</td>
                <td class="table-cell"><strong>${record.goods_id}</strong></td>
                <td class="table-cell">${record.goods_name}</td>
                <td class="table-cell">¥${record.unit_price?.toFixed(2) || '0.00'}</td>
                <td class="table-cell">${record.quantity || 1}</td>
                <td class="table-cell">¥${record.total_cost?.toFixed(2) || '0.00'}</td>
                <td class="table-cell">
                    <span class="status-badge ${statusClass}">
                        ${record.status}
                    </span>
                </td>
                <td class="table-cell">¥${record.shipping_fee?.toFixed(2) || '0.00'}</td>
                <td class="table-cell">${record.actual_income ? '¥' + record.actual_income.toFixed(2) : '-'}</td>
                <td class="table-cell profit-cell ${profitClass}">
                    ${record.profit !== null ? '¥' + record.profit.toFixed(2) : '-'}
                </td>
                <td class="table-cell">${record.submitter || '-'}</td>
                <td class="table-cell" title="${record.remark || ''}">
                    ${record.remark ? (record.remark.length > 20 ? record.remark.substring(0, 20) + '...' : record.remark) : '-'}
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
}

// 重置筛选条件
function resetFilters() {
    // 重置时间筛选
    elements.timeFilterTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.range === 'today');
    });
    
    // 重置其他筛选
    elements.goodsIdFilter.value = '';
    elements.submitterFilter.value = '';
    elements.statusFilter.value = 'all';
    elements.viewModeSelect.value = 'timeline';
    
    // 隐藏自定义日期范围
    document.getElementById('custom-date-range').classList.add('hidden');
    
    // 重新加载数据
    loadRecords();
    
    showNotification('筛选重置', '所有筛选条件已重置为默认值', 'info');
}

// 导出数据
function exportData() {
    if (allRecords.length === 0) {
        showNotification('导出失败', '没有可导出的数据', 'warning');
        return;
    }
    
    try {
        // 创建CSV内容
        const headers = ['时间', '货号', '尺码/款式', '单价', '数量', '总价', '状态', '运费', '收入', '利润', '提交人', '备注'];
        const csvRows = [
            headers.join(','),
            ...allRecords.map(record => [
                new Date(record.created_at).toLocaleString('zh-CN'),
                record.goods_id,
                record.goods_name,
                record.unit_price,
                record.quantity,
                record.total_cost,
                record.status,
                record.shipping_fee,
                record.actual_income || '',
                record.profit || '',
                record.submitter || '',
                record.remark || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ];
        
        const csvString = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        // 创建下载链接
        const link = document.createElement('a');
        link.href = url;
        link.download = `货品记录_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('导出成功', `已导出${allRecords.length}条记录到CSV文件`, 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showNotification('导出失败', error.message, 'error');
    }
}

// 更新实时统计
function updateLiveStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayRecords = allRecords.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate >= today && recordDate < tomorrow;
    });
    
    const todaySoldRecords = todayRecords.filter(r => r.status.includes('已卖出'));
    const todayProfit = todaySoldRecords.reduce((sum, r) => sum + (r.profit || 0), 0);
    
    elements.liveRecordCount.textContent = todayRecords.length;
    elements.liveProfitToday.textContent = `¥${todayProfit.toFixed(2)}`;
    
    // 更新统计卡片的变化值
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayRecords = allRecords.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate >= yesterday && recordDate < today;
    });
    
    const change = todayRecords.length - yesterdayRecords.length;
    const changeElement = document.querySelector('.stat-change.positive span');
    if (changeElement) {
        changeElement.innerHTML = change >= 0 ? `+${change} 今日` : `${change} 今日`;
    }
}

// 更新最后同步时间
function updateLastSyncTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    elements.lastSync.textContent = `最后同步: ${timeStr}`;
}

// 显示通知
function showNotification(title, message, type = 'success') {
    const notification = elements.notification;
    const icon = notification.querySelector('.notification-icon i');
    const titleEl = notification.querySelector('.notification-title');
    const messageEl = notification.querySelector('.notification-message');
    
    // 设置图标和颜色
    switch (type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            notification.style.borderLeftColor = 'var(--success-color)';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle';
            notification.style.borderLeftColor = 'var(--danger-color)';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle';
            notification.style.borderLeftColor = 'var(--warning-color)';
            break;
        case 'info':
            icon.className = 'fas fa-info-circle';
            notification.style.borderLeftColor = 'var(--info-color)';
            break;
    }
    
    // 设置内容
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // 显示通知
    notification.classList.remove('hidden');
    
    // 自动隐藏
   (() => {
        hideNotification setTimeout(() => {
        hideNotification();
();
    }, 500    }, 5000);
0);
}

}

//// 隐藏通知
function hideNotification() {
    elements.notification.classList.add('hidden');
}

// 初始化 隐藏通知
function hideNotification() {
    elements.notification.classList.add('hidden');
}

// 初始化通知关闭按钮通知关闭按钮
document.querySelector('.notification-close
document.querySelector('.notification-close')?.addEventListener('click', hideNotification')?.addEventListener('click', hideNotification);