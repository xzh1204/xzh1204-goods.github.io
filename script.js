// Supabase配置 - 需要替换为你的实际配置
const SUPABASE_URL = 'https://gbsqrtaooovsxnwftkbk.supabase.co'; // 替换为你的Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic3FydGFvb292c3hud2Z0a2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjM3ODcsImV4cCI6MjA4MDMzOTc4N30.FKUrAR1qr5bSNEJMomU24aYFDK-fep3eNjZY1n8QgN4'; // 替换为你的Supabase anon public key

// 初始化Supabase客户端
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM元素
let currentView = 'partner';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // 监听角色切换
    document.getElementById('role-partner').addEventListener('click', () => switchView('partner'));
    document.getElementById('role-accountant').addEventListener('click', () => switchView('accountant'));
    
    // 合伙人视图事件监听
    setupPartnerView();
    
    // 记账人视图事件监听
    setupAccountantView();
    
    // 测试模式（如果Supabase未配置，使用本地存储）
    if (SUPABASE_URL.includes('your-project') || SUPABASE_ANON_KEY.includes('your-anon-key')) {
        console.warn('Supabase配置未设置，使用本地存储模式');
        showMessage('请注意：当前使用本地存储模式，刷新页面数据会丢失。请配置Supabase以获得完整功能。', 'error');
    }
});

// 初始化应用
function initializeApp() {
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-from').value = today;
    document.getElementById('date-to').value = today;
    
    // 加载历史数据用于智能搜索
    loadGoodsHistory();
}

// 切换视图
function switchView(view) {
    currentView = view;
    
    // 更新按钮状态
    document.getElementById('role-partner').classList.toggle('active', view === 'partner');
    document.getElementById('role-accountant').classList.toggle('active', view === 'accountant');
    
    // 显示对应视图
    document.getElementById('partner-view').classList.toggle('active-view', view === 'partner');
    document.getElementById('accountant-view').classList.toggle('active-view', view === 'accountant');
    
    // 如果是记账人视图，加载数据
    if (view === 'accountant') {
        loadRecords();
    }
}

// 合伙人视图设置
function setupPartnerView() {
    const form = document.getElementById('goods-form');
    const statusSelect = document.getElementById('status');
    const unitPriceInput = document.getElementById('unit-price');
    const quantityInput = document.getElementById('quantity');
    const shippingFeeInput = document.getElementById('shipping-fee');
    const actualIncomeInput = document.getElementById('actual-income');
    const goodsIdInput = document.getElementById('goods-id');
    const resetBtn = document.getElementById('reset-form');
    
    // 监听状态变化，控制卖出相关字段显示
    statusSelect.addEventListener('change', function() {
        const soldFields = document.getElementById('sold-fields');
        const isSoldStatus = this.value.includes('已卖出');
        
        if (isSoldStatus) {
            soldFields.classList.remove('hidden');
            document.getElementById('actual-income').required = true;
        } else {
            soldFields.classList.add('hidden');
            document.getElementById('actual-income').required = false;
            document.getElementById('actual-income').value = '';
            document.getElementById('profit').value = '';
            document.getElementById('profit').classList.remove('profit-positive', 'profit-negative');
        }
    });
    
    // 监听价格和数量变化，自动计算总价
    unitPriceInput.addEventListener('input', calculateTotalCost);
    quantityInput.addEventListener('input', calculateTotalCost);
    
    // 监听运费输入，实时计算
    shippingFeeInput.addEventListener('input', function() {
        calculateShippingFee();
        // 如果已卖出状态，重新计算利润
        if (statusSelect.value.includes('已卖出')) {
            calculateProfit();
        }
    });
    
    // 监听实际收入变化，计算利润
    actualIncomeInput.addEventListener('input', calculateProfit);
    
    // 表单提交
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await submitGoodsRecord();
    });
    
    // 重置表单
    resetBtn.addEventListener('click', function() {
        form.reset();
        document.getElementById('quantity').value = 1;
        document.getElementById('sold-fields').classList.add('hidden');
        document.getElementById('profit').value = '';
        document.getElementById('profit').classList.remove('profit-positive', 'profit-negative');
        document.getElementById('total-cost').value = '';
        showMessage('表单已重置', 'success');
    });
    
    // 货号智能搜索
    goodsIdInput.addEventListener('input', function() {
        showGoodsSuggestions(this.value);
    });
}

// 记账人视图设置
function setupAccountantView() {
    // 时间筛选变化
    document.getElementById('time-filter').addEventListener('change', function() {
        const customRange = document.getElementById('custom-date-range');
        customRange.classList.toggle('hidden', this.value !== 'custom');
    });
    
    // 应用筛选
    document.getElementById('apply-filters').addEventListener('click', function() {
        loadRecords();
    });
    
    // 重置筛选
    document.getElementById('reset-filters').addEventListener('click', function() {
        document.getElementById('time-filter').value = 'all';
        document.getElementById('custom-date-range').classList.add('hidden');
        document.getElementById('goods-id-filter').value = '';
        document.getElementById('status-filter').value = 'all';
        document.getElementById('submitter-filter').value = '';
        document.getElementById('view-mode').value = 'timeline';
        
        loadRecords();
    });
    
    // 刷新数据
    document.getElementById('refresh-data').addEventListener('click', function() {
        loadRecords();
    });
    
    // 导出数据
    document.getElementById('export-data').addEventListener('click', exportData);
}

// 计算总价
function calculateTotalCost() {
    const unitPrice = parseFloat(document.getElementById('unit-price').value) || 0;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const totalCost = unitPrice * quantity;
    
    document.getElementById('total-cost').value = totalCost.toFixed(2);
    
    // 如果已卖出状态，重新计算利润
    if (document.getElementById('status').value.includes('已卖出')) {
        calculateProfit();
    }
}

// 计算运费
function calculateShippingFee() {
    const shippingFeeInput = document.getElementById('shipping-fee');
    const feeExpression = shippingFeeInput.value.trim();
    
    if (!feeExpression) {
        return 0;
    }
    
    try {
        // 安全地计算数学表达式
        const fee = eval(feeExpression.replace(/[^-()\d/*+.]/g, ''));
        return isNaN(fee) ? 0 : parseFloat(fee.toFixed(2));
    } catch (error) {
        return 0;
    }
}

// 计算利润
function calculateProfit() {
    const totalCost = parseFloat(document.getElementById('total-cost').value) || 0;
    const shippingFee = calculateShippingFee();
    const actualIncome = parseFloat(document.getElementById('actual-income').value) || 0;
    
    // 利润 = 实际收入 - 总成本 - 运费
    const profit = actualIncome - totalCost - shippingFee;
    const profitInput = document.getElementById('profit');
    
    profitInput.value = profit.toFixed(2);
    
    // 根据利润正负设置颜色
    profitInput.classList.remove('profit-positive', 'profit-negative');
    if (profit > 0) {
        profitInput.classList.add('profit-positive');
    } else if (profit < 0) {
        profitInput.classList.add('profit-negative');
    }
}

// 显示商品建议
async function showGoodsSuggestions(goodsId) {
    const suggestionsDiv = document.getElementById('suggestions');
    suggestionsDiv.innerHTML = '';
    
    if (!goodsId || goodsId.length < 2) {
        suggestionsDiv.classList.remove('active');
        return;
    }
    
    try {
        // 从Supabase查询匹配的货号
        const { data, error } = await supabase
            .from('goods_records')
            .select('goods_id, goods_name, unit_price')
            .ilike('goods_id', `%${goodsId}%`)
            .limit(5);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            data.forEach(item => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'suggestion-item';
                suggestionItem.textContent = `${item.goods_id} - ${item.goods_name} (¥${item.unit_price})`;
                
                suggestionItem.addEventListener('click', function() {
                    document.getElementById('goods-id').value = item.goods_id;
                    document.getElementById('goods-name').value = item.goods_name;
                    document.getElementById('unit-price').value = item.unit_price;
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.remove('active');
                    
                    // 触发价格计算
                    calculateTotalCost();
                });
                
                suggestionsDiv.appendChild(suggestionItem);
            });
            
            suggestionsDiv.classList.add('active');
        } else {
            suggestionsDiv.classList.remove('active');
        }
    } catch (error) {
        console.error('获取商品建议失败:', error);
        suggestionsDiv.classList.remove('active');
    }
}

// 加载商品历史记录（用于智能搜索）
async function loadGoodsHistory() {
    try {
        // 从Supabase获取所有商品记录
        const { data, error } = await supabase
            .from('goods_records')
            .select('goods_id, goods_name, unit_price')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        // 存储到本地用于快速搜索（可选）
        if (data) {
            localStorage.setItem('goods_history', JSON.stringify(data));
        }
    } catch (error) {
        console.error('加载商品历史失败:', error);
    }
}

// 提交商品记录
async function submitGoodsRecord() {
    // 获取表单数据
    const formData = {
        goods_id: document.getElementById('goods-id').value,
        goods_name: document.getElementById('goods-name').value,
        unit_price: parseFloat(document.getElementById('unit-price').value),
        quantity: parseInt(document.getElementById('quantity').value),
        total_cost: parseFloat(document.getElementById('total-cost').value) || 0,
        status: document.getElementById('status').value,
        shipping_fee: calculateShippingFee(),
        shipping_note: document.getElementById('shipping-note').value,
        actual_income: document.getElementById('actual-income').value ? 
                       parseFloat(document.getElementById('actual-income').value) : null,
        profit: document.getElementById('profit').value ? 
                parseFloat(document.getElementById('profit').value) : null,
        remark: document.getElementById('remark').value,
        submitter: document.getElementById('submitter').value || null,
        created_at: new Date().toISOString()
    };
    
    // 验证必填字段
    if (!formData.goods_id || !formData.goods_name || !formData.unit_price || 
        !formData.status || isNaN(formData.shipping_fee)) {
        showMessage('请填写所有必填字段', 'error');
        return;
    }
    
    // 如果是卖出状态，验证实际收入
    if (formData.status.includes('已卖出') && (formData.actual_income === null || isNaN(formData.actual_income))) {
        showMessage('卖出状态必须填写实际收入', 'error');
        return;
    }
    
    try {
        // 插入数据到Supabase
        const { data, error } = await supabase
            .from('goods_records')
            .insert([formData])
            .select();
        
        if (error) throw error;
        
        // 提交成功
        showMessage('记录提交成功！', 'success');
        
        // 重置表单
        document.getElementById('goods-form').reset();
        document.getElementById('quantity').value = 1;
        document.getElementById('sold-fields').classList.add('hidden');
        document.getElementById('profit').value = '';
        document.getElementById('profit').classList.remove('profit-positive', 'profit-negative');
        document.getElementById('total-cost').value = '';
        
        // 重新加载商品历史
        loadGoodsHistory();
        
        // 如果当前是记账人视图，刷新数据
        if (currentView === 'accountant') {
            loadRecords();
        }
        
    } catch (error) {
        console.error('提交记录失败:', error);
        showMessage('提交失败：' + error.message, 'error');
    }
}

// 加载记录数据
async function loadRecords() {
    const tableBody = document.getElementById('records-table');
    tableBody.innerHTML = '<div class="loading">加载数据中...</div>';
    
    try {
        // 构建查询
        let query = supabase.from('goods_records').select('*');
        
        // 应用时间筛选
        const timeFilter = document.getElementById('time-filter').value;
        if (timeFilter !== 'all') {
            const now = new Date();
            let startDate, endDate;
            
            switch (timeFilter) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
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
                    const dateFrom = document.getElementById('date-from').value;
                    const dateTo = document.getElementById('date-to').value;
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
        const goodsIdFilter = document.getElementById('goods-id-filter').value;
        if (goodsIdFilter) {
            query = query.ilike('goods_id', `%${goodsIdFilter}%`);
        }
        
        const statusFilter = document.getElementById('status-filter').value;
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }
        
        const submitterFilter = document.getElementById('submitter-filter').value;
        if (submitterFilter) {
            query = query.ilike('submitter', `%${submitterFilter}%`);
        }
        
        // 按时间倒序排序
        query = query.order('created_at', { ascending: false });
        
        // 执行查询
        const { data, error } = await query;
        
        if (error) throw error;
        
        // 更新统计数据
        updateStatistics(data || []);
        
        // 根据视图模式显示数据
        const viewMode = document.getElementById('view-mode').value;
        displayRecords(data || [], viewMode);
        
    } catch (error) {
        console.error('加载记录失败:', error);
        tableBody.innerHTML = '<div class="loading" style="color: #e74c3c;">加载失败：' + error.message + '</div>';
    }
}

// 更新统计数据
function updateStatistics(records) {
    if (!records || records.length === 0) {
        document.getElementById('total-records').textContent = '0';
        document.getElementById('total-profit').textContent = '¥0.00';
        document.getElementById('total-cost-sum').textContent = '¥0.00';
        document.getElementById('avg-profit-margin').textContent = '0%';
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
    document.getElementById('total-records').textContent = totalRecords;
    document.getElementById('total-profit').textContent = `¥${totalProfit.toFixed(2)}`;
    document.getElementById('total-profit').style.color = totalProfit >= 0 ? '#2ecc71' : '#e74c3c';
    document.getElementById('total-cost-sum').textContent = `¥${totalCostSum.toFixed(2)}`;
    document.getElementById('avg-profit-margin').textContent = `${avgProfitMargin.toFixed(1)}%`;
    document.getElementById('avg-profit-margin').style.color = avgProfitMargin >= 0 ? '#2ecc71' : '#e74c3c';
}

// 显示记录数据
function displayRecords(records, viewMode) {
    const tableBody = document.getElementById('records-table');
    
    if (records.length === 0) {
        tableBody.innerHTML = '<div class="loading">没有找到相关记录</div>';
        return;
    }
    
    let html = '';
    
    if (viewMode === 'timeline') {
        // 时间线视图
        html = createTimelineView(records);
    } else if (viewMode === 'grouped') {
        // 按货号分组视图
        html = createGroupedView(records);
    } else if (viewMode === 'monthly') {
        // 按月汇总视图
        html = createMonthlyView(records);
    } else {
        // 默认表格视图
        html = createTableView(records);
    }
    
    tableBody.innerHTML = html;
}

// 创建时间线视图
function createTimelineView(records) {
    let html = '<table>';
    html += `
        <thead>
            <tr>
                <th>时间</th>
                <th>货号</th>
                <th>尺码/款式</th>
                <th>状态</th>
                <th>成本</th>
                <th>收入</th>
                <th>利润</th>
                <th>提交人</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    records.forEach(record => {
        const date = new Date(record.created_at);
        const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let statusClass = '';
        if (record.status.includes('已卖出')) statusClass = 'status-sold';
        else if (record.status.includes('退回')) statusClass = 'status-returned';
        else if (record.status.includes('上架') || record.status.includes('下架')) statusClass = 'status-unsold';
        
        html += `
            <tr>
                <td>${timeStr}</td>
                <td><strong>${record.goods_id}</strong></td>
                <td>${record.goods_name}</td>
                <td><span class="status-badge ${statusClass}">${record.status}</span></td>
                <td>¥${record.total_cost?.toFixed(2) || '0.00'}</td>
                <td>${record.actual_income ? '¥' + record.actual_income.toFixed(2) : '-'}</td>
                <td style="color: ${record.profit >= 0 ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                    ${record.profit !== null ? '¥' + record.profit.toFixed(2) : '-'}
                </td>
                <td>${record.submitter || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
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
    
    let html = '';
    
    Object.keys(grouped).forEach(goodsId => {
        const goodsRecords = grouped[goodsId];
        const firstRecord = goodsRecords[0];
        
        html += `
            <div class="goods-group" style="margin-bottom: 25px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                <div class="group-header" style="background: #f8f9fa; padding: 15px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>货号: ${goodsId} - ${firstRecord.goods_name}</span>
                    <span>记录数: ${goodsRecords.length}</span>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>状态</th>
                                <th>单价</th>
                                <th>数量</th>
                                <th>总成本</th>
                                <th>收入</th>
                                <th>利润</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        goodsRecords.forEach(record => {
            const date = new Date(record.created_at);
            const timeStr = `${date.getMonth()+1}/${date.getDate()}`;
            
            html += `
                <tr>
                    <td>${timeStr}</td>
                    <td>${record.status}</td>
                    <td>¥${record.unit_price?.toFixed(2) || '0.00'}</td>
                    <td>${record.quantity || 1}</td>
                    <td>¥${record.total_cost?.toFixed(2) || '0.00'}</td>
                    <td>${record.actual_income ? '¥' + record.actual_income.toFixed(2) : '-'}</td>
                    <td style="color: ${record.profit >= 0 ? '#2ecc71' : '#e74c3c'};">
                        ${record.profit !== null ? '¥' + record.profit.toFixed(2) : '-'}
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div></div>';
    });
    
    return html;
}

// 创建按月汇总视图
function createMonthlyView(records) {
    // 按月分组
    const monthly = {};
    records.forEach(record => {
        const date = new Date(record.created_at);
        const monthKey = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}`;
        
        if (!monthly[monthKey]) {
            monthly[monthKey] = {
                records: [],
                totalCost: 0,
                totalIncome: 0,
                totalProfit: 0,
                soldCount: 0
            };
        }
        
        monthly[monthKey].records.push(record);
        monthly[monthKey].totalCost += record.total_cost || 0;
        
        if (record.status.includes('已卖出')) {
            monthly[monthKey].totalIncome += record.actual_income || 0;
            monthly[monthKey].totalProfit += record.profit || 0;
            monthly[monthKey].soldCount++;
        }
    });
    
    let html = '<table>';
    html += `
        <thead>
            <tr>
                <th>月份</th>
                <th>记录数</th>
                <th>卖出数量</th>
                <th>总成本</th>
                <th>总收入</th>
                <th>总利润</th>
                <th>利润率</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    // 按月排序
    const months = Object.keys(monthly).sort().reverse();
    
    months.forEach(monthKey => {
        const data = monthly[monthKey];
        const profitMargin = data.totalIncome > 0 ? (data.totalProfit / data.totalIncome * 100) : 0;
        
        html += `
            <tr>
                <td><strong>${monthKey}</strong></td>
                <td>${data.records.length}</td>
                <td>${data.soldCount}</td>
                <td>¥${data.totalCost.toFixed(2)}</td>
                <td>¥${data.totalIncome.toFixed(2)}</td>
                <td style="color: ${data.totalProfit >= 0 ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                    ¥${data.totalProfit.toFixed(2)}
                </td>
                <td style="color: ${profitMargin >= 0 ? '#2ecc71' : '#e74c3c'};">
                    ${profitMargin.toFixed(1)}%
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

// 创建表格视图
function createTableView(records) {
    let html = '<table>';
    html += `
        <thead>
            <tr>
                <th>时间</th>
                <th>货号</th>
                <th>尺码/款式</th>
                <th>单价</th>
                <th>数量</th>
                <th>总价</th>
                <th>状态</th>
                <th>运费</th>
                <th>收入</th>
                <th>利润</th>
                <th>提交人</th>
                <th>备注</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    records.forEach(record => {
        const date = new Date(record.created_at);
        const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        html += `
            <tr>
                <td>${timeStr}</td>
                <td>${record.goods_id}</td>
                <td>${record.goods_name}</td>
                <td>¥${record.unit_price?.toFixed(2) || '0.00'}</td>
                <td>${record.quantity || 1}</td>
                <td>¥${record.total_cost?.toFixed(2) || '0.00'}</td>
                <td>${record.status}</td>
                <td>¥${record.shipping_fee?.toFixed(2) || '0.00'}</td>
                <td>${record.actual_income ? '¥' + record.actual_income.toFixed(2) : '-'}</td>
                <td style="color: ${record.profit >= 0 ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                    ${record.profit !== null ? '¥' + record.profit.toFixed(2) : '-'}
                </td>
                <td>${record.submitter || '-'}</td>
                <td>${record.remark || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

// 导出数据
function exportData() {
    try {
        // 这里可以扩展为导出CSV或Excel格式
        alert('导出功能需要进一步开发。目前建议使用筛选后复制表格数据。');
    } catch (error) {
        console.error('导出数据失败:', error);
        showMessage('导出失败: ' + error.message, 'error');
    }
}

// 显示消息
function showMessage(message, type) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 3000);
}