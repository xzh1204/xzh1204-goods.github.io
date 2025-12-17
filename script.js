// script.js - 货品管理账本专业版主逻辑 - 修复版

// ========== 全局变量和初始化 ==========
let currentRecords = [];
let allGoodsRecords = [];
let currentFilters = {
    period: 'all',
    startDate: null,
    endDate: null,
    goodsId: '',
    status: '',
    submitter: ''
};
let currentPage = 1;
let pageSize = 20;
let totalPages = 1;
let supabase = null;
let selectedGoodsId = null;
let isUpdateMode = false;
let goodsTemplates = {};

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// 初始化应用
function initApp() {
    console.log('🚀 应用初始化开始');
    
    // 获取Supabase客户端
    supabase = window.supabaseClient;
    console.log('Supabase客户端已初始化');
    
    // 测试连接
    testSupabaseConnection();
    
    // 初始化日期选择器
    initDatePickers();
    
    // 初始化事件监听
    initEventListeners();
    
    // 初始化表单计算
    initFormCalculations();
    
    // 加载现有记录
    loadAllRecords();
    
    // 加载货号模板
    loadGoodsTemplates();
    
    // 更新最后同步时间
    updateLastSyncTime();
    
    // 设置自动刷新（每60秒）
    setInterval(loadAllRecords, 60000);
    
    // 检查URL参数
    checkUrlParams();
}

// 测试Supabase连接
async function testSupabaseConnection() {
    console.log('🔍 测试Supabase连接...');
    
    try {
        const { data, error } = await supabase
            .from('goods_records')
            .select('count(*)')
            .limit(1);
            
        if (error) {
            console.error('❌ Supabase连接失败:', error);
            showMessage('数据库连接失败，请检查配置', 'error');
        } else {
            console.log('✅ Supabase连接成功');
        }
    } catch (err) {
        console.error('❌ 连接测试异常:', err);
    }
}

// 初始化日期选择器
function initDatePickers() {
    flatpickr("#startDate", {
        dateFormat: "Y-m-d",
        maxDate: "today",
        onChange: function(selectedDates, dateStr) {
            currentFilters.startDate = dateStr;
        }
    });
    
    flatpickr("#endDate", {
        dateFormat: "Y-m-d",
        maxDate: "today",
        onChange: function(selectedDates, dateStr) {
            currentFilters.endDate = dateStr;
        }
    });
}

// ========== 事件监听器初始化 ==========
function initEventListeners() {
    // 角色切换
    document.getElementById('roleSubmitBtn').addEventListener('click', () => switchRole('submit'));
    document.getElementById('roleViewBtn').addEventListener('click', () => switchRole('view'));
    
    // 表单模式切换
    document.getElementById('modeNew').addEventListener('click', () => switchFormMode('new'));
    document.getElementById('modeUpdate').addEventListener('click', () => switchFormMode('update'));
    
    // 货号搜索
    document.getElementById('searchGoodsBtn').addEventListener('click', searchGoods);
    document.getElementById('goodsIdSearch').addEventListener('input', handleGoodsSearchInput);
    document.getElementById('goodsIdSearch').addEventListener('change', handleGoodsSelect);
    
    // 表单相关
    document.getElementById('goodsForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    
    // 运费自动计算
    document.getElementById('shippingExpr').addEventListener('input', calculateShipping);
    
    // 实际收入变化时计算利润
    document.getElementById('actualIncome').addEventListener('input', calculateProfit);
    
    document.getElementById('saveTemplateBtn').addEventListener('click', saveGoodsTemplate);
    
    // 查看记录相关
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadAllRecords();
        showMessage('正在刷新数据...', 'info');
    });
    
    // 时间筛选
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilters.period = this.dataset.period;
            applyFilters();
        });
    });
    
    // 日期范围
    document.getElementById('applyDateRange').addEventListener('click', applyDateRange);
    
    // 高级筛选
    document.getElementById('filterGoodsId').addEventListener('input', applyFilters);
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('filterSubmitter').addEventListener('input', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
    
    // 视图标签
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            displayRecordsByView(this.dataset.view);
        });
    });
    
    // 分页
    document.getElementById('prevPage').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(currentPage + 1));
    
    // 导出操作
    document.getElementById('copyAllBtn').addEventListener('click', copyFilteredRecords);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('printBtn').addEventListener('click', printRecords);
    
    // 批量操作
    document.getElementById('batchDeleteBtn').addEventListener('click', batchDeleteRecords);
    
    // 模态框
    document.querySelector('.modal-close').addEventListener('click', closeGoodsDetailModal);
    document.getElementById('overlay').addEventListener('click', closeGoodsDetailModal);
    
    // 状态选择变化监听
    document.getElementById('status').addEventListener('change', handleStatusChange);
    
    // 月份选择器
    document.getElementById('monthSelector').addEventListener('change', loadMonthlyStats);
    
    // 单价和数量变化时重新计算利润
    document.getElementById('unitPrice').addEventListener('input', () => {
        calculateTotalCost();
        if (document.getElementById('status').value.includes('已卖出')) {
            calculateProfit();
        }
    });
    
    document.getElementById('quantity').addEventListener('input', () => {
        calculateTotalCost();
        if (document.getElementById('status').value.includes('已卖出')) {
            calculateProfit();
        }
    });
}

// 检查URL参数
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const goodsId = urlParams.get('goods_id');
    if (goodsId) {
        // 自动切换到查看模式并筛选该货号
        switchRole('view');
        document.getElementById('filterGoodsId').value = goodsId;
        currentFilters.goodsId = goodsId;
        applyFilters();
    }
}

// ========== 表单模式切换 ==========
function switchFormMode(mode) {
    const newBtn = document.getElementById('modeNew');
    const updateBtn = document.getElementById('modeUpdate');
    
    if (mode === 'new') {
        newBtn.classList.add('active');
        updateBtn.classList.remove('active');
        isUpdateMode = false;
        resetForm();
        document.getElementById('goodsIdSearch').placeholder = '输入新货号';
        showMessage('新建记录模式：请输入新货号创建记录', 'info');
    } else {
        newBtn.classList.remove('active');
        updateBtn.classList.add('active');
        isUpdateMode = true;
        resetForm();
        document.getElementById('goodsIdSearch').placeholder = '搜索已有货号进行更新';
        showMessage('更新模式：搜索已有货号更新状态', 'info');
    }
}

// ========== 货号搜索与自动填充 ==========
function handleGoodsSearchInput() {
    const searchValue = document.getElementById('goodsIdSearch').value;
    if (searchValue.length >= 2) {
        updateGoodsList(searchValue);
    }
}

function updateGoodsList(searchTerm) {
    const goodsList = document.getElementById('goodsList');
    goodsList.innerHTML = '';
    
    // 从模板中搜索
    const matchedGoods = Object.keys(goodsTemplates).filter(goodsId => 
        goodsId.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    matchedGoods.forEach(goodsId => {
        const option = document.createElement('option');
        option.value = goodsId;
        option.textContent = `${goodsId} - ${goodsTemplates[goodsId].size || '未记录尺码'}`;
        goodsList.appendChild(option);
    });
}

function handleGoodsSelect() {
    const selectedValue = document.getElementById('goodsIdSearch').value;
    if (selectedValue && goodsTemplates[selectedValue]) {
        // 找到匹配的货号模板，自动填充
        fillFormFromTemplate(selectedValue);
    } else if (selectedValue && !isUpdateMode) {
        // 新货号，只填充货号字段
        document.getElementById('goodsId').value = selectedValue;
    }
}

function searchGoods() {
    const searchValue = document.getElementById('goodsIdSearch').value.trim();
    if (!searchValue) {
        showMessage('请输入货号进行搜索', 'error');
        return;
    }
    
    if (goodsTemplates[searchValue]) {
        // 找到模板，自动填充
        fillFormFromTemplate(searchValue);
        showMessage(`找到货号 "${searchValue}"，已自动填充信息`, 'success');
    } else if (isUpdateMode) {
        // 更新模式下搜索数据库
        searchGoodsInDatabase(searchValue);
    } else {
        // 新建模式，设置货号
        document.getElementById('goodsId').value = searchValue;
        document.getElementById('goodsSize').value = '';
        showMessage('未找到该货号的模板，请输入尺码/款式', 'info');
    }
}

function searchGoodsInDatabase(goodsId) {
    // 从Supabase搜索该货号的记录
    supabase
        .from('goods_records')
        .select('*')
        .eq('goods_id', goodsId)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data, error }) => {
            if (error) {
                console.error('搜索失败:', error);
                showMessage('搜索失败，请稍后重试', 'error');
                return;
            }
            
            if (data && data.length > 0) {
                const latestRecord = data[0];
                fillFormFromRecord(latestRecord);
                showMessage(`找到货号 "${goodsId}" 的最新记录，已自动填充`, 'success');
            } else {
                showMessage(`未找到货号 "${goodsId}" 的记录`, 'error');
            }
        });
}

function fillFormFromTemplate(goodsId) {
    const template = goodsTemplates[goodsId];
    document.getElementById('goodsId').value = goodsId;
    document.getElementById('goodsSize').value = template.size || '';
    document.getElementById('unitPrice').value = template.unit_price || '';
    document.getElementById('shippingExpr').value = template.shipping_fee || '';
    document.getElementById('shippingNote').value = template.shipping_note || '';
    
    // 触发计算
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
    calculateShipping();
    
    // 如果是更新模式，不修改状态，让用户选择新状态
    if (!isUpdateMode) {
        document.getElementById('status').value = template.last_status || '';
        handleStatusChange();
    }
}

function fillFormFromRecord(record) {
    document.getElementById('goodsId').value = record.goods_id;
    document.getElementById('goodsSize').value = record.goods_name || '';
    document.getElementById('unitPrice').value = record.unit_price || '';
    document.getElementById('quantity').value = record.quantity || 1;
    document.getElementById('shippingExpr').value = record.shipping_fee || '';
    document.getElementById('shippingNote').value = record.shipping_note || '';
    document.getElementById('actualIncome').value = record.actual_income || '';
    document.getElementById('remark').value = record.remark || '';
    
    // 触发计算
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
    calculateShipping();
    
    // 如果是更新模式，不自动选择状态
    if (!isUpdateMode) {
        document.getElementById('status').value = record.status || '';
        handleStatusChange();
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

// 运费计算 - 自动计算
function calculateShipping() {
    const shippingExpr = document.getElementById('shippingExpr');
    const shippingFeeInput = document.getElementById('shippingFee');
    const calcHint = document.getElementById('shippingCalcHint');
    
    const inputValue = shippingExpr.value.trim();
    
    if (!inputValue) {
        shippingFeeInput.value = '0';
        calcHint.textContent = '请输入运费数字或算式';
        calcHint.style.color = '#6c757d';
        return;
    }
    
    try {
        // 安全计算表达式
        const expr = inputValue.replace(/[^0-9+\-*/().\s]/g, '');
        if (!expr) {
            throw new Error('无效输入');
        }
        
        const result = Function('"use strict"; return (' + expr + ')')();
        
        if (isNaN(result) || !isFinite(result)) {
            throw new Error('计算结果无效');
        }
        
        const roundedResult = parseFloat(result.toFixed(2));
        shippingFeeInput.value = roundedResult;
        
        // 如果输入的是算式，显示计算结果提示
        if (inputValue.includes('+') || inputValue.includes('-') || 
            inputValue.includes('*') || inputValue.includes('/')) {
            calcHint.textContent = `计算结果: ${roundedResult.toFixed(2)} 元`;
            calcHint.style.color = '#28a745';
        } else {
            calcHint.textContent = '输入有效';
            calcHint.style.color = '#28a745';
        }
        
        // 重新计算利润
        if (document.getElementById('incomeSection').style.display !== 'none') {
            calculateProfit();
        }
    } catch (error) {
        shippingFeeInput.value = '0';
        calcHint.textContent = '请输入有效的数字或算式（如: 3.68+3.68）';
        calcHint.style.color = '#dc3545';
    }
}

// 利润计算 - 修复：确保正确计算和显示
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
        const actualIncome = parseFloat(document.getElementById('actualIncome').value) || 0;
        formData.profit = actualIncome - totalCost - shippingFee;
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
            
            // 保存为模板
            saveGoodsTemplateToLocal(formData);
            
            // 重置表单
            resetForm();
            
            // 如果是更新模式，自动切换到查看模式
            if (isUpdateMode) {
                setTimeout(() => {
                    switchRole('view');
                    loadAllRecords();
                }, 1500);
            }
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

// 验证表单 - 修复：提交人改为选填
function validateForm() {
    const goodsId = document.getElementById('goodsId').value.trim();
    const unitPrice = document.getElementById('unitPrice').value;
    const status = document.getElementById('status').value;
    
    if (!goodsId) {
        showMessage('请输入货号', 'error');
        return false;
    }
    
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
        showMessage('请输入有效的拿货单价', 'error');
        return false;
    }
    
    if (!status) {
        showMessage('请选择货品状态', 'error');
        return false;
    }
    
    if (status.includes('已卖出')) {
        const actualIncome = document.getElementById('actualIncome').value;
        if (!actualIncome || parseFloat(actualIncome) <= 0) {
            showMessage('卖出状态下必须填写实际收入', 'error');
            return false;
        }
    }
    
    // 提交人改为选填，不需要验证
    
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
    
    // 尺码/款式字段
    const goodsSize = document.getElementById('goodsSize').value.trim();
    
    // 提交人改为选填
    const submitter = document.getElementById('submitter').value.trim();
    
    return {
        goods_id: document.getElementById('goodsId').value.trim(),
        goods_name: goodsSize || null,
        unit_price: parseFloat(document.getElementById('unitPrice').value) || 0,
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        total_cost: parseFloat(document.getElementById('totalCost').value) || 0,
        status: document.getElementById('status').value,
        shipping_fee: parseFloat(shippingFee) || 0,
        shipping_note: document.getElementById('shippingNote').value.trim(),
        actual_income: document.getElementById('status').value.includes('已卖出') ? 
            parseFloat(document.getElementById('actualIncome').value) || 0 : null,
        remark: document.getElementById('remark').value.trim(),
        submitter: submitter || '未填写', // 修复：设为选填，默认值
        created_at: new Date().toISOString()
    };
}

// 提交到Supabase - 简化版
async function submitToSupabase(formData) {
    if (!supabase) {
        showMessage('❌ 数据库连接未初始化', 'error');
        return false;
    }
    
    console.log('正在提交数据到Supabase:', formData);
    
    try {
        const { data, error } = await supabase
            .from('goods_records')
            .insert([formData])
            .select();
        
        if (error) {
            console.error('Supabase提交错误:', error);
            
            let errorMsg = '提交失败: ';
            if (error.code) errorMsg += `[${error.code}] `;
            errorMsg += error.message;
            
            // 显示更详细的错误信息
            if (error.code === '42501') {
                errorMsg += '\n\n请检查Supabase RLS策略设置：\n1. 进入Supabase后台\n2. 找到Authentication → Policies\n3. 为goods_records表添加INSERT策略\n4. 或暂时关闭RLS';
            } else if (error.message.includes('JWT')) {
                errorMsg += '\n\n请检查Supabase配置：\n1. 确认URL和Key正确\n2. 使用anon public key\n3. 确认项目状态正常';
            }
            
            alert(errorMsg);
            return false;
        }
        
        console.log('数据提交成功:', data);
        
        // 更新本地记录列表
        if (data && data[0]) {
            allGoodsRecords.unshift(data[0]);
        }
        
        return true;
    } catch (error) {
        console.error('提交异常:', error);
        alert('网络错误: ' + error.message);
        return false;
    }
}

// 保存货号模板到本地
function saveGoodsTemplateToLocal(formData) {
    if (!formData.goods_id) return;
    
    goodsTemplates[formData.goods_id] = {
        size: formData.goods_name || '',
        unit_price: formData.unit_price,
        shipping_fee: formData.shipping_fee,
        shipping_note: formData.shipping_note,
        last_status: formData.status,
        updated_at: new Date().toISOString()
    };
    
    localStorage.setItem('goods_templates', JSON.stringify(goodsTemplates));
}

// 保存模板按钮点击
function saveGoodsTemplate() {
    const goodsId = document.getElementById('goodsId').value.trim();
    if (!goodsId) {
        showMessage('请先填写货号', 'error');
        return;
    }
    
    const goodsSize = document.getElementById('goodsSize').value.trim();
    const unitPrice = document.getElementById('unitPrice').value;
    const shippingExpr = document.getElementById('shippingExpr').value;
    const shippingNote = document.getElementById('shippingNote').value.trim();
    
    if (!goodsSize && !unitPrice && !shippingExpr && !shippingNote) {
        showMessage('请至少填写一项信息以保存为模板', 'error');
        return;
    }
    
    saveGoodsTemplateToLocal({
        goods_id: goodsId,
        goods_name: goodsSize,
        unit_price: parseFloat(unitPrice) || 0,
        shipping_fee: parseFloat(shippingExpr) || 0,
        shipping_note: shippingNote,
        status: document.getElementById('status').value || ''
    });
    
    showMessage(`✅ 货号 "${goodsId}" 已保存为模板，下次输入时可自动填充`, 'success');
}

// 加载货号模板
function loadGoodsTemplates() {
    const savedTemplates = localStorage.getItem('goods_templates');
    if (savedTemplates) {
        goodsTemplates = JSON.parse(savedTemplates);
        console.log('加载货号模板:', Object.keys(goodsTemplates).length);
    }
}

// 重置表单
function resetForm() {
    document.getElementById('goodsForm').reset();
    document.getElementById('goodsIdSearch').value = '';
    document.getElementById('totalCost').value = '0.00';
    document.getElementById('shippingExpr').value = '';
    document.getElementById('shippingFee').value = '';
    document.getElementById('profitDisplay').value = '';
    document.getElementById('incomeSection').style.display = 'none';
    document.getElementById('goodsId').removeAttribute('readonly');
    document.getElementById('goodsId').value = '';
    document.getElementById('shippingCalcHint').textContent = '输入后自动计算';
    document.getElementById('shippingCalcHint').style.color = '#6c757d';
    
    // 触发总价计算
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
    
    // 如果是更新模式，清空只读字段
    if (isUpdateMode) {
        document.getElementById('goodsId').setAttribute('readonly', 'true');
    }
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
        loadAllRecords();
    }
}

// ========== 数据加载与筛选 ==========
// 加载所有记录
async function loadAllRecords() {
    try {
        showLoading(true);
        
        const { data, error } = await supabase
            .from('goods_records')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        allGoodsRecords = data || [];
        currentRecords = [...allGoodsRecords];
        
        // 应用当前筛选条件
        applyFilters();
        
        // 更新统计信息
        updateStats();
        
        // 更新月度统计
        loadMonthlyStats();
        
        // 更新货号模板
        updateGoodsTemplatesFromRecords();
        
        updateLastSyncTime();
        
        showMessage(`✅ 已加载 ${allGoodsRecords.length} 条记录`, 'success');
        
    } catch (error) {
        console.error('加载记录错误:', error);
        showMessage('❌ 加载记录失败: ' + error.message, 'error');
        displayRecords([]);
    } finally {
        showLoading(false);
    }
}

// 从记录更新货号模板
function updateGoodsTemplatesFromRecords() {
    allGoodsRecords.forEach(record => {
        if (!record.goods_id) return;
        
        if (!goodsTemplates[record.goods_id] || 
            new Date(record.created_at) > new Date(goodsTemplates[record.goods_id].updated_at || 0)) {
            
            goodsTemplates[record.goods_id] = {
                size: record.goods_name || '',
                unit_price: record.unit_price,
                shipping_fee: record.shipping_fee,
                shipping_note: record.shipping_note,
                last_status: record.status,
                updated_at: record.created_at
            };
        }
    });
    
    localStorage.setItem('goods_templates', JSON.stringify(goodsTemplates));
}

// 应用筛选条件
function applyFilters() {
    let filteredRecords = [...allGoodsRecords];
    
    // 按时间周期筛选
    if (currentFilters.period !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (currentFilters.period) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
        }
        
        filteredRecords = filteredRecords.filter(record => 
            new Date(record.created_at) >= startDate
        );
    }
    
    // 按日期范围筛选
    if (currentFilters.startDate) {
        const startDate = new Date(currentFilters.startDate);
        startDate.setHours(0, 0, 0, 0);
        filteredRecords = filteredRecords.filter(record => 
            new Date(record.created_at) >= startDate
        );
    }
    
    if (currentFilters.endDate) {
        const endDate = new Date(currentFilters.endDate);
        endDate.setHours(23, 59, 59, 999);
        filteredRecords = filteredRecords.filter(record => 
            new Date(record.created_at) <= endDate
        );
    }
    
    // 按货号筛选
    if (currentFilters.goodsId) {
        filteredRecords = filteredRecords.filter(record => 
            record.goods_id && record.goods_id.toLowerCase().includes(currentFilters.goodsId.toLowerCase())
        );
    }
    
    // 按状态筛选
    if (currentFilters.status) {
        filteredRecords = filteredRecords.filter(record => 
            record.status === currentFilters.status
        );
    }
    
    // 按提交人筛选
    if (currentFilters.submitter) {
        filteredRecords = filteredRecords.filter(record => 
            record.submitter && record.submitter.toLowerCase().includes(currentFilters.submitter.toLowerCase())
        );
    }
    
    currentRecords = filteredRecords;
    
    // 重置到第一页
    currentPage = 1;
    
    // 显示记录
    displayRecordsByView();
    
    // 更新统计
    updateStats();
}

// 应用日期范围
function applyDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    currentFilters.startDate = startDate || null;
    currentFilters.endDate = endDate || null;
    
    if (startDate || endDate) {
        currentFilters.period = 'custom';
        document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    applyFilters();
}

// 清除所有筛选
function clearAllFilters() {
    // 重置筛选条件
    currentFilters = {
        period: 'all',
        startDate: null,
        endDate: null,
        goodsId: '',
        status: '',
        submitter: ''
    };
    
    // 重置UI
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === 'all') {
            btn.classList.add('active');
        }
    });
    
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('filterGoodsId').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSubmitter').value = '';
    
    // 应用筛选
    applyFilters();
    
    showMessage('筛选条件已清除', 'success');
}

// ========== 显示记录 ==========
// 按视图显示记录
function displayRecordsByView(viewType = null) {
    if (!viewType) {
        const activeTab = document.querySelector('.view-tab.active');
        viewType = activeTab ? activeTab.dataset.view : 'timeline';
    }
    
    switch (viewType) {
        case 'byGoods':
            displayRecordsByGoods();
            break;
        case 'byMonth':
            displayRecordsByMonth();
            break;
        case 'timeline':
        default:
            displayTimelineRecords();
            break;
    }
}

// 时间线视图
function displayTimelineRecords() {
    const recordsList = document.getElementById('recordsList');
    const emptyMessage = document.getElementById('emptyMessage');
    const pagination = document.getElementById('pagination');
    
    if (!currentRecords || currentRecords.length === 0) {
        recordsList.innerHTML = '';
        emptyMessage.style.display = 'block';
        pagination.style.display = 'none';
        return;
    }
    
    emptyMessage.style.display = 'none';
    
    // 计算分页
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageRecords = currentRecords.slice(startIndex, endIndex);
    totalPages = Math.ceil(currentRecords.length / pageSize);
    
    // 更新分页信息
    updatePagination();
    
    let html = '';
    
    // 按日期分组
    const groupedByDate = {};
    pageRecords.forEach(record => {
        const date = new Date(record.created_at).toLocaleDateString('zh-CN');
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(record);
    });
    
    // 按日期倒序
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
        new Date(b) - new Date(a)
    );
    
    sortedDates.forEach(date => {
        html += `
            <div class="date-group">
                <div class="date-header">
                    <i class="fas fa-calendar-day"></i> ${date}
                    <span class="date-count">${groupedByDate[date].length} 条记录</span>
                </div>
                <div class="date-records">
        `;
        
        groupedByDate[date].forEach(record => {
            html += createRecordItemHTML(record);
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    recordsList.innerHTML = html;
    
    // 添加查看详情事件
    document.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const goodsId = this.dataset.goodsId;
            showGoodsDetailModal(goodsId);
        });
    });
}

// 创建单个记录项的HTML - 修复：确保利润显示
function createRecordItemHTML(record, compact = false) {
    const profit = record.profit !== null ? parseFloat(record.profit) : null;
    const profitClass = profit !== null ? 
        (profit > 0 ? 'positive' : profit < 0 ? 'negative' : '') : '';
    
    const statusClass = record.status.includes('卖出') ? 'sold' : 
                       record.status.includes('退回') ? 'returned' :
                       record.status.includes('下架') ? 'offShelf' : 'unsold';
    
    const actualIncomeText = record.actual_income !== null ? 
        `<div class="record-field">
            <span class="record-label">实际收入:</span>
            <span class="record-value">${record.actual_income.toFixed(2)} 元</span>
        </div>` : '';
    
    const profitText = profit !== null ? 
        `<div class="record-field">
            <span class="record-label">利润:</span>
            <span class="record-profit ${profitClass}">${profit.toFixed(2)} 元</span>
        </div>` : '';
    
    const remarkText = record.remark ? 
        `<div class="record-field">
            <span class="record-label">备注:</span>
            <span class="record-value">${record.remark}</span>
        </div>` : '';
    
    // 尺码/款式显示
    const sizeText = record.goods_name ? 
        `<div class="record-field">
            <span class="record-label">尺码/款式:</span>
            <span class="record-value">${record.goods_name}</span>
        </div>` : '';
    
    const compactClass = compact ? 'compact' : '';
    
    return `
        <div class="record-item ${statusClass} ${compactClass}">
            <div class="record-header">
                <div class="record-title">
                    <i class="fas fa-barcode"></i> ${record.goods_id}
                </div>
                <div class="record-status ${statusClass}">${record.status}</div>
            </div>
            
            <div class="record-body">
                ${sizeText}
                
                <div class="record-field">
                    <span class="record-label">成本:</span>
                    <span class="record-value">
                        ${record.unit_price.toFixed(2)} 元 × ${record.quantity} = ${record.total_cost.toFixed(2)} 元
                    </span>
                </div>
                
                <div class="record-field">
                    <span class="record-label">运费:</span>
                    <span class="record-value">
                        ${record.shipping_fee.toFixed(2)} 元
                        ${record.shipping_note ? `(${record.shipping_note})` : ''}
                    </span>
                </div>
                
                ${actualIncomeText}
                ${profitText}
                ${remarkText}
            </div>
            
            <div class="record-footer">
                <div class="record-info">
                    <span><i class="fas fa-user"></i> ${record.submitter || '未填写'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDateTime(record.created_at)}</span>
                </div>
                <div class="record-actions">
                    <button class="record-action-btn view-detail-btn" data-goods-id="${record.goods_id}">
                        <i class="fas fa-info-circle"></i> 详情
                    </button>
                    <button class="record-action-btn update-btn" data-record-id="${record.id}">
                        <i class="fas fa-edit"></i> 更新
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ========== 分页控制 ==========
function updatePagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    // 更新按钮状态
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // 更新页码信息
    pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
}

function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    
    // 重新显示当前视图的记录
    const activeTab = document.querySelector('.view-tab.active');
    const viewType = activeTab ? activeTab.dataset.view : 'timeline';
    displayRecordsByView(viewType);
    
    // 滚动到顶部
    document.getElementById('recordsContainer').scrollIntoView({ behavior: 'smooth' });
}

// ========== 统计信息 ==========
function updateStats() {
    const totalRecords = document.getElementById('totalRecords');
    const totalProfitSum = document.getElementById('totalProfitSum');
    const totalCostSum = document.getElementById('totalCostSum');
    const avgProfitRate = document.getElementById('avgProfitRate');
    
    // 基本统计
    totalRecords.textContent = currentRecords.length;
    
    // 计算总利润和总成本（只计算卖出记录）
    const soldRecords = currentRecords.filter(r => r.profit !== null);
    const profitSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.profit) || 0), 0);
    const costSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.total_cost) || 0), 0);
    const incomeSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.actual_income) || 0), 0);
    
    totalProfitSum.textContent = profitSum.toFixed(2);
    totalCostSum.textContent = costSum.toFixed(2);
    
    // 设置颜色
    totalProfitSum.style.color = profitSum >= 0 ? '#2ecc71' : '#e74c3c';
    
    // 计算平均利润率
    let avgRate = 0;
    if (incomeSum > 0 && soldRecords.length > 0) {
        avgRate = (profitSum / incomeSum) * 100;
    }
    avgProfitRate.textContent = avgRate.toFixed(1) + '%';
    avgProfitRate.style.color = avgRate >= 0 ? '#2ecc71' : '#e74c3c';
}

// ========== 工具函数 ==========
// 显示消息
function showMessage(text, type) {
    const messageBox = document.getElementById('formMessage');
    messageBox.textContent = text;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    
    // 3秒后自动隐藏（错误消息5秒）
    const timeout = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, timeout);
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

// 页面加载完成的初始化
console.log('货品管理账本专业版已加载 - 修复版：利润显示和提交人选填');