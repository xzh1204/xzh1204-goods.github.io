// script.js - 货品管理账本专业版主逻辑

// script.js - 货品管理账本专业版主逻辑

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
    console.log('DOM加载完成，开始初始化应用...');
    
    // 等待一小会儿确保supabaseClient已初始化
    setTimeout(() => {
        initApp();
    }, 500);
});

// 初始化应用
function initApp() {
    console.log('正在初始化应用...');
    
    // 尝试获取Supabase客户端
    supabase = window.supabaseClient;
    
    if (!supabase) {
        console.warn('Supabase客户端未初始化，使用本地模式');
        // 仍然继续，只是没有数据库功能
    } else {
        console.log('✅ Supabase连接成功');
    }
    
    // 初始化所有功能
    try {
        initDatePickers();
        initEventListeners();
        initFormCalculations();
        
        // 检查displayRecords函数是否存在
        if (typeof displayRecords === 'undefined') {
            console.error('displayRecords函数未定义！');
            // 临时定义一个
            window.displayRecords = function(records) {
                console.log('临时displayRecords:', records);
            };
        }
        
        loadAllRecords();
        loadGoodsTemplates();
        updateLastSyncTime();
        setInterval(loadAllRecords, 60000);
        checkUrlParams();
        
        console.log('✅ 应用初始化完成');
        
    } catch (error) {
        console.error('应用初始化错误:', error);
        showMessage('应用初始化失败: ' + error.message, 'error');
    }
}
// ✅ 从这开始，后面所有函数都保持你原来的代码
// initDatePickers, initEventListeners, initFormCalculations等都不需要修改
// 利润计算、总价计算、状态变化处理等所有业务逻辑都保持原样
// 无数据库的初始化（当Supabase连接失败时）
function initApplicationWithoutDB() {
    console.log('开始无数据库初始化...');
    
    // 仍然可以初始化的功能
    initDatePickers();
    initEventListeners();
    initFormCalculations();
    loadGoodsTemplates();
    checkUrlParams();
    
    // 禁用需要数据库的功能
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-ban"></i> 数据库未连接';
        submitBtn.title = '数据库连接失败，无法提交数据';
    }
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-ban"></i> 刷新';
        refreshBtn.title = '数据库连接失败，无法刷新数据';
    }
    
    console.log('✅ 无数据库初始化完成（部分功能受限）');
}

// 显示连接错误信息
function showConnectionError() {
    const errorHtml = `
        <div style="
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            color: #856404;
            font-size: 14px;
        ">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 18px;"></i>
                <strong>数据库连接失败</strong>
            </div>
            <p style="margin: 5px 0;">可能的原因：</p>
            <ul style="margin: 5px 0; padding-left: 20px;">
                <li>网络连接问题</li>
                <li>浏览器安全设置阻止了外部资源</li>
                <li>Supabase服务暂时不可用</li>
            </ul>
            <p style="margin: 10px 0 5px 0;">
                <button onclick="location.reload()" style="
                    padding: 8px 16px;
                    background: #f0ad4e;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    <i class="fas fa-redo"></i> 刷新页面
                </button>
            </p>
        </div>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        const roleSwitch = document.querySelector('.role-switch');
        if (roleSwitch && roleSwitch.nextSibling) {
            roleSwitch.insertAdjacentHTML('afterend', errorHtml);
        }
    }
    
    showMessage('⚠️ 数据库连接失败，提交和刷新功能不可用', 'warning', 0);
}

// ✅ 以下完全保持你原来的所有函数代码
// initDatePickers, initEventListeners, initFormCalculations 等所有函数都不需要修改
// 利润计算、总价计算等所有业务逻辑都保持不变
// 初始化日期选择器
function initDatePickers() {
    if (typeof flatpickr !== 'undefined') {
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
    document.getElementById('shippingExpr').addEventListener('input', calculateShippingAuto);
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
}

// 检查URL参数
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const goodsId = urlParams.get('goods_id');
    if (goodsId) {
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
    
    const matchedGoods = Object.keys(goodsTemplates).filter(goodsId => 
        goodsId.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    matchedGoods.forEach(goodsId => {
        const option = document.createElement('option');
        option.value = goodsId;
        option.textContent = `${goodsId} - ${goodsTemplates[goodsId].name || '未命名'}`;
        goodsList.appendChild(option);
    });
}

function handleGoodsSelect() {
    const selectedValue = document.getElementById('goodsIdSearch').value;
    if (selectedValue && goodsTemplates[selectedValue]) {
        fillFormFromTemplate(selectedValue);
    } else if (selectedValue && !isUpdateMode) {
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
        fillFormFromTemplate(searchValue);
        showMessage(`找到货号 "${searchValue}"，已自动填充信息`, 'success');
    } else if (isUpdateMode) {
        searchGoodsInDatabase(searchValue);
    } else {
        document.getElementById('goodsId').value = searchValue;
        document.getElementById('goodsName').value = '';
        showMessage('未找到该货号的模板，请输入码数/款式', 'info');
    }
}

function searchGoodsInDatabase(goodsId) {
    if (!supabase) {
        showMessage('❌ 数据库未连接，无法搜索', 'error');
        return;
    }
    
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
    document.getElementById('goodsName').value = template.name || '';
    document.getElementById('unitPrice').value = template.unit_price || '';
    document.getElementById('shippingExpr').value = template.shipping_fee || '';
    document.getElementById('shippingNote').value = template.shipping_note || '';
    
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
    calculateShippingAuto();
    
    if (!isUpdateMode) {
        document.getElementById('status').value = template.last_status || '';
        handleStatusChange();
    }
}

function fillFormFromRecord(record) {
    document.getElementById('goodsId').value = record.goods_id;
    document.getElementById('goodsName').value = record.goods_name || '';
    document.getElementById('unitPrice').value = record.unit_price || '';
    document.getElementById('quantity').value = record.quantity || 1;
    document.getElementById('shippingExpr').value = record.shipping_fee || '';
    document.getElementById('shippingNote').value = record.shipping_note || '';
    document.getElementById('actualIncome').value = record.actual_income || '';
    document.getElementById('remark').value = record.remark || '';
    
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
    calculateShippingAuto();
    
    if (!isUpdateMode) {
        document.getElementById('status').value = record.status || '';
        handleStatusChange();
    }
}

// ========== 表单计算逻辑 ==========
function initFormCalculations() {
    const unitPriceInput = document.getElementById('unitPrice');
    const quantityInput = document.getElementById('quantity');
    
    function calculateTotalCost() {
        const unitPrice = parseFloat(unitPriceInput.value) || 0;
        const quantity = parseInt(quantityInput.value) || 1;
        const totalCost = unitPrice * quantity;
        document.getElementById('totalCost').value = totalCost.toFixed(2);
        
        if (document.getElementById('incomeSection').style.display !== 'none') {
            calculateProfit();
        }
    }
    
    unitPriceInput.addEventListener('input', calculateTotalCost);
    quantityInput.addEventListener('input', calculateTotalCost);
    
    calculateTotalCost();
}

// 运费自动计算
function calculateShippingAuto() {
    const shippingExpr = document.getElementById('shippingExpr');
    const shippingFeeInput = document.getElementById('shippingFee');
    
    try {
        const expr = shippingExpr.value.trim();
        if (!expr) {
            shippingFeeInput.value = '0';
            if (document.getElementById('incomeSection').style.display !== 'none') {
                calculateProfit();
            }
            return;
        }
        
        const safeExpr = expr.replace(/[^0-9+\-*/().\s]/g, '');
        if (!safeExpr) {
            shippingFeeInput.value = '0';
            return;
        }
        
        const result = Function('"use strict"; return (' + safeExpr + ')')();
        
        if (isNaN(result) || !isFinite(result)) {
            throw new Error('计算结果无效');
        }
        
        const roundedResult = parseFloat(result.toFixed(2));
        shippingFeeInput.value = roundedResult;
        
        if (document.getElementById('incomeSection').style.display !== 'none') {
            calculateProfit();
        }
    } catch (error) {
        const numValue = parseFloat(shippingExpr.value);
        if (!isNaN(numValue) && isFinite(numValue)) {
            const roundedValue = parseFloat(numValue.toFixed(2));
            shippingFeeInput.value = roundedValue;
            
            if (document.getElementById('incomeSection').style.display !== 'none') {
                calculateProfit();
            }
        } else {
            shippingFeeInput.value = '0';
        }
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
    
    if (status.includes('已卖出')) {
        incomeSection.style.display = 'block';
        calculateProfit();
    } else {
        incomeSection.style.display = 'none';
        document.getElementById('actualIncome').value = '';
        document.getElementById('profitDisplay').value = '';
        document.getElementById('profitDisplay').classList.remove('positive', 'negative');
    }
}

// ========== 表单提交处理 ==========
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const formData = collectFormData();
    
    if (formData.status.includes('已卖出')) {
        const totalCost = parseFloat(document.getElementById('totalCost').value) || 0;
        const shippingFee = parseFloat(document.getElementById('shippingFee').value) || 0;
        formData.profit = formData.actual_income - totalCost - shippingFee;
    } else {
        formData.profit = null;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
    submitBtn.disabled = true;
    
    try {
        const success = await submitToSupabase(formData);
        
        if (success) {
            showMessage('✅ 记录提交成功！数据已保存至云端。', 'success');
            
            saveGoodsTemplateToLocal(formData);
            
            resetForm();
            
            if (isUpdateMode) {
                setTimeout(() => {
                    switchRole('view');
                    loadAllRecords();
                }, 1500);
            }
        } else {
            showMessage('❌ 提交失败，请检查网络连接或稍后重试。', 'error');
        }
    } catch (error) {
        console.error('提交处理错误:', error);
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
    
    return true;
}

// 收集表单数据
function collectFormData() {
    const shippingExpr = document.getElementById('shippingExpr').value;
    let shippingFee = document.getElementById('shippingFee').value;
    
    if (!shippingFee && shippingExpr) {
        try {
            const safeExpr = shippingExpr.replace(/[^0-9+\-*/().\s]/g, '');
            if (safeExpr) {
                const result = Function('"use strict"; return (' + safeExpr + ')')();
                if (!isNaN(result) && isFinite(result)) {
                    shippingFee = result.toFixed(2);
                }
            }
        } catch (error) {
            const numValue = parseFloat(shippingExpr);
            shippingFee = !isNaN(numValue) ? numValue.toFixed(2) : '0';
        }
    }
    
    return {
        goods_id: document.getElementById('goodsId').value.trim(),
        goods_name: document.getElementById('goodsName').value.trim() || null,
        unit_price: parseFloat(document.getElementById('unitPrice').value) || 0,
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        total_cost: parseFloat(document.getElementById('totalCost').value) || 0,
        status: document.getElementById('status').value,
        shipping_fee: parseFloat(shippingFee) || 0,
        shipping_note: document.getElementById('shippingNote').value.trim(),
        actual_income: document.getElementById('status').value.includes('已卖出') ? 
            parseFloat(document.getElementById('actualIncome').value) || 0 : null,
        remark: document.getElementById('remark').value.trim(),
        submitter: document.getElementById('submitter').value.trim() || '未填写',
        created_at: new Date().toISOString()
    };
}

// 提交到Supabase - 只在开头添加连接检查
async function submitToSupabase(formData) {
    // ✅ 添加：检查Supabase连接
    if (!supabase) {
        showMessage('❌ 数据库未连接，无法提交', 'error');
        return false;
    }
    
    // ✅ 完全保持你原来的提交代码
    try {
        const { data, error } = await supabase
            .from('goods_records')
            .insert([formData])
            .select();
        
        if (error) {
            throw error;
        }
        
        console.log('数据提交成功:', data);
        
        if (data && data[0]) {
            allGoodsRecords.unshift(data[0]);
        }
        
        return true;
        
    } catch (error) {
        console.error('Supabase提交错误:', error);
        
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
// 保存货号模板到本地
function saveGoodsTemplateToLocal(formData) {
    if (!formData.goods_id) return;
    
    goodsTemplates[formData.goods_id] = {
        name: formData.goods_name || '',
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
    
    const goodsName = document.getElementById('goodsName').value.trim();
    const unitPrice = document.getElementById('unitPrice').value;
    const shippingExpr = document.getElementById('shippingExpr').value;
    const shippingNote = document.getElementById('shippingNote').value.trim();
    
    if (!goodsName && !unitPrice && !shippingExpr && !shippingNote) {
        showMessage('请至少填写一项信息以保存为模板', 'error');
        return;
    }
    
    saveGoodsTemplateToLocal({
        goods_id: goodsId,
        goods_name: goodsName,
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
    document.getElementById('profitDisplay').classList.remove('positive', 'negative');
    document.getElementById('incomeSection').style.display = 'none';
    document.getElementById('goodsId').removeAttribute('readonly');
    document.getElementById('goodsId').value = '';
    
    document.getElementById('unitPrice').dispatchEvent(new Event('input'));
    
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

// 加载所有记录
async function loadAllRecords() {
    try {
        showLoading(true);
        
        // 检查Supabase连接
        if (!supabase) {
            console.log('Supabase未连接，使用本地数据');
            
            // 使用本地存储的数据或空数组
            allGoodsRecords = JSON.parse(localStorage.getItem('local_goods_records') || '[]');
            currentRecords = [...allGoodsRecords];
            
            // 更新UI
            applyFilters();
            updateStats();
            loadMonthlyStats();
            updateLastSyncTime();
            
            // 确保displayRecords函数存在
            if (typeof displayRecords === 'function') {
                displayRecords(currentRecords);
            } else {
                console.error('displayRecords函数不存在！');
                // 临时处理：更新记录列表
                updateRecordsDisplay();
            }
            
            return;
        }
        
        // 原有的数据库代码
        const { data, error } = await supabase
            .from('goods_records')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        allGoodsRecords = data || [];
        currentRecords = [...allGoodsRecords];
        
        applyFilters();
        updateStats();
        loadMonthlyStats();
        updateGoodsTemplatesFromRecords();
        updateLastSyncTime();
        
        if (typeof displayRecords === 'function') {
            displayRecords(currentRecords);
        }
        
        showMessage(`✅ 已加载 ${allGoodsRecords.length} 条记录`, 'success');
        
    } catch (error) {
        console.error('加载记录错误:', error);
        showMessage('❌ 加载记录失败: ' + error.message, 'error');
        
        // 错误时显示空状态
        if (typeof displayRecords === 'function') {
            displayRecords([]);
        }
    } finally {
        showLoading(false);
    }
}// 从记录更新货号模板
function updateGoodsTemplatesFromRecords() {
    allGoodsRecords.forEach(record => {
        if (!record.goods_id) return;
        
        if (!goodsTemplates[record.goods_id] || 
            new Date(record.created_at) > new Date(goodsTemplates[record.goods_id].updated_at || 0)) {
            
            goodsTemplates[record.goods_id] = {
                name: record.goods_name || '',
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
    
    if (currentFilters.goodsId) {
        filteredRecords = filteredRecords.filter(record => 
            record.goods_id && record.goods_id.toLowerCase().includes(currentFilters.goodsId.toLowerCase())
        );
    }
    
    if (currentFilters.status) {
        filteredRecords = filteredRecords.filter(record => 
            record.status === currentFilters.status
        );
    }
    
    if (currentFilters.submitter) {
        filteredRecords = filteredRecords.filter(record => 
            record.submitter && record.submitter.toLowerCase().includes(currentFilters.submitter.toLowerCase())
        );
    }
    
    currentRecords = filteredRecords;
    currentPage = 1;
    displayRecordsByView();
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
    currentFilters = {
        period: 'all',
        startDate: null,
        endDate: null,
        goodsId: '',
        status: '',
        submitter: ''
    };
    
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
    
    applyFilters();
    
    showMessage('筛选条件已清除', 'success');
}

// ========== 显示记录 ==========
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
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageRecords = currentRecords.slice(startIndex, endIndex);
    totalPages = Math.ceil(currentRecords.length / pageSize);
    
    updatePagination();
    
    let html = '';
    
    const groupedByDate = {};
    pageRecords.forEach(record => {
        const date = new Date(record.created_at).toLocaleDateString('zh-CN');
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(record);
    });
    
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
    
    document.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const goodsId = this.dataset.goodsId;
            showGoodsDetailModal(goodsId);
        });
    });
}

// 按货号分组视图
function displayRecordsByGoods() {
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
    pagination.style.display = 'flex';
    
    const groupedByGoods = {};
    currentRecords.forEach(record => {
        if (!record.goods_id) return;
        
        if (!groupedByGoods[record.goods_id]) {
            groupedByGoods[record.goods_id] = {
                name: record.goods_name || record.goods_id,
                records: [],
                totalProfit: 0,
                totalCost: 0,
                lastStatus: record.status,
                lastUpdate: record.created_at
            };
        }
        
        groupedByGoods[record.goods_id].records.push(record);
        if (record.profit) {
            groupedByGoods[record.goods_id].totalProfit += parseFloat(record.profit);
        }
        groupedByGoods[record.goods_id].totalCost += parseFloat(record.total_cost || 0);
        
        if (new Date(record.created_at) > new Date(groupedByGoods[record.goods_id].lastUpdate)) {
            groupedByGoods[record.goods_id].lastStatus = record.status;
            groupedByGoods[record.goods_id].lastUpdate = record.created_at;
        }
    });
    
    const sortedGoodsIds = Object.keys(groupedByGoods).sort();
    
    let html = '';
    
    sortedGoodsIds.forEach(goodsId => {
        const goodsData = groupedByGoods[goodsId];
        const records = goodsData.records.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        
        html += `
            <div class="goods-group">
                <div class="goods-header">
                    <div class="goods-title">
                        <i class="fas fa-box"></i> ${goodsId}
                        <span class="goods-name">${goodsData.name !== goodsId ? `(${goodsData.name})` : ''}</span>
                    </div>
                    <div class="goods-stats">
                        <span class="stat-item">
                            <i class="fas fa-history"></i> ${records.length} 次记录
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-money-bill-wave"></i> 总利润: ${goodsData.totalProfit.toFixed(2)} 元
                        </span>
                        <span class="stat-item status-${goodsData.lastStatus.includes('卖出') ? 'sold' : 'unsold'}">
                            ${goodsData.lastStatus}
                        </span>
                        <button class="goods-detail-btn" data-goods-id="${goodsId}">
                            <i class="fas fa-info-circle"></i> 详情
                        </button>
                    </div>
                </div>
                <div class="goods-records">
        `;
        
        const recentRecords = records.slice(0, 3);
        recentRecords.forEach(record => {
            html += createRecordItemHTML(record, true);
        });
        
        if (records.length > 3) {
            html += `
                <div class="more-records">
                    <i class="fas fa-ellipsis-h"></i> 还有 ${records.length - 3} 条历史记录
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    });
    
    recordsList.innerHTML = html;
    
    document.querySelectorAll('.goods-detail-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const goodsId = this.dataset.goodsId;
            showGoodsDetailModal(goodsId);
        });
    });
}

// 按月汇总视图
function displayRecordsByMonth() {
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
    pagination.style.display = 'none';
    
    const groupedByMonth = {};
    currentRecords.forEach(record => {
        const date = new Date(record.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = `${date.getFullYear()}年${date.getMonth() + 1}月`;
        
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = {
                name: monthName,
                records: [],
                totalProfit: 0,
                totalCost: 0,
                totalIncome: 0,
                soldCount: 0,
                unsoldCount: 0
            };
        }
        
        groupedByMonth[monthKey].records.push(record);
        
        if (record.profit) {
            groupedByMonth[monthKey].totalProfit += parseFloat(record.profit);
        }
        
        groupedByMonth[monthKey].totalCost += parseFloat(record.total_cost || 0);
        
        if (record.actual_income) {
            groupedByMonth[monthKey].totalIncome += parseFloat(record.actual_income);
        }
        
        if (record.status.includes('卖出')) {
            groupedByMonth[monthKey].soldCount++;
        } else {
            groupedByMonth[monthKey].unsoldCount++;
        }
    });
    
    const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));
    
    let html = '';
    
    sortedMonths.forEach(monthKey => {
        const monthData = groupedByMonth[monthKey];
        
        html += `
            <div class="month-group">
                <div class="month-header">
                    <i class="fas fa-calendar-alt"></i> ${monthData.name}
                    <span class="month-stats">
                        <span class="stat-badge">
                            <i class="fas fa-list"></i> ${monthData.records.length} 条
                        </span>
                        <span class="stat-badge ${monthData.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
                            <i class="fas fa-chart-line"></i> ${monthData.totalProfit.toFixed(2)} 元
                        </span>
                    </span>
                </div>
                
                <div class="month-summary">
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-label">总成本</div>
                            <div class="summary-value">${monthData.totalCost.toFixed(2)} 元</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">总收入</div>
                            <div class="summary-value">${monthData.totalIncome.toFixed(2)} 元</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">已卖出</div>
                            <div class="summary-value">${monthData.soldCount} 件</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">未卖出</div>
                            <div class="summary-value">${monthData.unsoldCount} 件</div>
                        </div>
                    </div>
                </div>
                
                <div class="month-records">
        `;
        
        const recentRecords = monthData.records.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        ).slice(0, 5);
        
        recentRecords.forEach(record => {
            html += createRecordItemHTML(record, true);
        });
        
        if (monthData.records.length > 5) {
            html += `
                <div class="more-records">
                    <i class="fas fa-ellipsis-h"></i> 本月还有 ${monthData.records.length - 5} 条记录
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    });
    
    recordsList.innerHTML = html;
}

// 创建单个记录项的HTML
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
    
    const compactClass = compact ? 'compact' : '';
    
    return `
        <div class="record-item ${statusClass} ${compactClass}">
            <div class="record-header">
                <div class="record-title">
                    <i class="fas fa-barcode"></i> ${record.goods_id}
                    ${record.goods_name && record.goods_name !== record.goods_id ? 
                        `<span class="record-subtitle">${record.goods_name}</span>` : ''}
                </div>
                <div class="record-status ${statusClass}">${record.status}</div>
            </div>
            
            <div class="record-body">
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
                    <span><i class="fas fa-user"></i> ${record.submitter}</span>
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
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
}

function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    
    const activeTab = document.querySelector('.view-tab.active');
    const viewType = activeTab ? activeTab.dataset.view : 'timeline';
    displayRecordsByView(viewType);
    
    document.getElementById('recordsContainer').scrollIntoView({ behavior: 'smooth' });
}

// ========== 统计信息 ==========
function updateStats() {
    const totalRecords = document.getElementById('totalRecords');
    const totalProfitSum = document.getElementById('totalProfitSum');
    const totalCostSum = document.getElementById('totalCostSum');
    const avgProfitRate = document.getElementById('avgProfitRate');
    
    totalRecords.textContent = currentRecords.length;
    
    const soldRecords = currentRecords.filter(r => r.profit !== null);
    const profitSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.profit) || 0), 0);
    const costSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.total_cost) || 0), 0);
    const incomeSum = soldRecords.reduce((sum, record) => sum + (parseFloat(record.actual_income) || 0), 0);
    
    totalProfitSum.textContent = profitSum.toFixed(2);
    totalCostSum.textContent = costSum.toFixed(2);
    
    totalProfitSum.style.color = profitSum >= 0 ? '#2ecc71' : '#e74c3c';
    
    let avgRate = 0;
    if (incomeSum > 0 && soldRecords.length > 0) {
        avgRate = (profitSum / incomeSum) * 100;
    }
    avgProfitRate.textContent = avgRate.toFixed(1) + '%';
    avgProfitRate.style.color = avgRate >= 0 ? '#2ecc71' : '#e74c3c';
}

// 加载月度统计
async function loadMonthlyStats() {
    const selectedMonth = document.getElementById('monthSelector').value;
    const monthlyStatsDiv = document.getElementById('monthlyStats');
    
    const monthSelector = document.getElementById('monthSelector');
    if (monthSelector.options.length === 0) {
        const monthsSet = new Set();
        allGoodsRecords.forEach(record => {
            const date = new Date(record.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(monthKey);
        });
        
        const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
        
        sortedMonths.forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const option = document.createElement('option');
            option.value = monthKey;
            option.textContent = `${year}年${parseInt(month)}月`;
            monthSelector.appendChild(option);
        });
        
        if (sortedMonths.length > 0) {
            monthSelector.value = sortedMonths[0];
        }
    }
    
    const monthlyData = calculateMonthlyStats(selectedMonth);
    
    let html = `
        <div class="month-stat-item">
            <div class="month-header">
                <i class="fas fa-chart-bar"></i> ${monthlyData.monthName} 统计
            </div>
            <div class="month-data">
                <div class="month-data-item">
                    <div class="month-data-label">总记录数</div>
                    <div class="month-data-value">${monthlyData.totalRecords} 条</div>
                </div>
                <div class="month-data-item">
                    <div class="month-data-label">总利润</div>
                    <div class="month-data-value" style="color: ${monthlyData.totalProfit >= 0 ? '#2ecc71' : '#e74c3c'}">
                        ${monthlyData.totalProfit.toFixed(2)} 元
                    </div>
                </div>
                <div class="month-data-item">
                    <div class="month-data-label">总成本</div>
                    <div class="month-data-value">${monthlyData.totalCost.toFixed(2)} 元</div>
                </div>
                <div class="month-data-item">
                    <div class="month-data-label">利润率</div>
                    <div class="month-data-value" style="color: ${monthlyData.profitRate >= 0 ? '#2ecc71' : '#e74c3c'}">
                        ${monthlyData.profitRate.toFixed(1)}%
                    </div>
                </div>
                <div class="month-data-item">
                    <div class="month-data-label">卖出数量</div>
                    <div class="month-data-value">${monthlyData.soldCount} 件</div>
                </div>
                <div class="month-data-item">
                    <div class="month-data-label">未卖出数量</div>
                    <div class="month-data-value">${monthlyData.unsoldCount} 件</div>
                </div>
            </div>
        </div>
    `;
    
    monthlyStatsDiv.innerHTML = html;
}

function calculateMonthlyStats(monthKey) {
    const monthRecords = allGoodsRecords.filter(record => {
        const date = new Date(record.created_at);
        const recordMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return recordMonthKey === monthKey;
    });
    
    const [year, month] = monthKey.split('-');
    const monthName = `${year}年${parseInt(month)}月`;
    
    const soldRecords = monthRecords.filter(r => r.status && r.status.includes('卖出'));
    const unsoldRecords = monthRecords.filter(r => !r.status || !r.status.includes('卖出'));
    
    const totalProfit = soldRecords.reduce((sum, record) => sum + (parseFloat(record.profit) || 0), 0);
    const totalCost = soldRecords.reduce((sum, record) => sum + (parseFloat(record.total_cost) || 0), 0);
    const totalIncome = soldRecords.reduce((sum, record) => sum + (parseFloat(record.actual_income) || 0), 0);
    
    const profitRate = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    
    return {
        monthName,
        totalRecords: monthRecords.length,
        totalProfit,
        totalCost,
        totalIncome,
        profitRate,
        soldCount: soldRecords.length,
        unsoldCount: unsoldRecords.length
    };
}

// ========== 货号详情模态框 ==========
function showGoodsDetailModal(goodsId) {
    selectedGoodsId = goodsId;
    
    const goodsRecords = allGoodsRecords.filter(record => record.goods_id === goodsId);
    
    if (goodsRecords.length === 0) {
        showMessage('未找到该货号的记录', 'error');
        return;
    }
    
    document.getElementById('modalGoodsId').textContent = goodsId;
    
    let html = '';
    
    const sortedRecords = goodsRecords.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    sortedRecords.forEach((record, index) => {
        const profit = record.profit !== null ? parseFloat(record.profit) : null;
        const profitClass = profit !== null ? 
            (profit > 0 ? 'positive' : profit < 0 ? 'negative' : '') : '';
        
        html += `
            <div class="goods-history-item">
                <div class="goods-history-header">
                    <div class="goods-history-date">
                        ${formatDateTime(record.created_at)}
                        <span class="status-badge status-${record.status.includes('卖出') ? 'sold' : 'unsold'}">
                            ${record.status}
                        </span>
                    </div>
                    <div class="goods-history-submitter">
                        <i class="fas fa-user"></i> ${record.submitter}
                    </div>
                </div>
                <div class="goods-history-body">
                    <div class="history-field">
                        <span class="history-label">单价:</span>
                        <span class="history-value">${record.unit_price.toFixed(2)} 元</span>
                    </div>
                    <div class="history-field">
                        <span class="history-label">数量:</span>
                        <span class="history-value">${record.quantity}</span>
                    </div>
                    <div class="history-field">
                        <span class="history-label">总成本:</span>
                        <span class="history-value">${record.total_cost.toFixed(2)} 元</span>
                    </div>
                    <div class="history-field">
                        <span class="history-label">运费:</span>
                        <span class="history-value">${record.shipping_fee.toFixed(2)} 元</span>
                    </div>
        `;
        
        if (record.actual_income) {
            html += `
                <div class="history-field">
                    <span class="history-label">实际收入:</span>
                    <span class="history-value">${record.actual_income.toFixed(2)} 元</span>
                </div>
            `;
        }
        
        if (profit !== null) {
            html += `
                <div class="history-field">
                    <span class="history-label">利润:</span>
                    <span class="history-value ${profitClass}">${profit.toFixed(2)} 元</span>
                </div>
            `;
        }
        
        if (record.remark) {
            html += `
                <div class="history-field full-width">
                    <span class="history-label">备注:</span>
                    <span class="history-value">${record.remark}</span>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    });
    
    document.getElementById('goodsHistory').innerHTML = html;
    
    document.getElementById('goodsDetailModal').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
    
    if (!document.querySelector('#history-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'history-styles';
        styleEl.textContent = `
            .goods-history-item {
                background: #f8f9fa;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 15px;
                border-left: 4px solid var(--info-color);
            }
            
            .goods-history-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e9ecef;
            }
            
            .goods-history-date {
                font-weight: 600;
                color: var(--dark-color);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .status-badge {
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 600;
            }
            
            .status-sold {
                background: #d4edda;
                color: #155724;
            }
            
            .status-unsold {
                background: #fff3cd;
                color: #856404;
            }
            
            .goods-history-submitter {
                color: var(--gray-color);
                font-size: 0.9rem;
            }
            
            .goods-history-body {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
            }
            
            .history-field {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 0;
            }
            
            .history-label {
                color: var(--gray-color);
                font-size: 0.9rem;
            }
            
            .history-value {
                font-weight: 500;
                color: var(--dark-color);
            }
            
            .history-value.positive {
                color: #2ecc71;
            }
            
            .history-value.negative {
                color: #e74c3c;
            }
            
            .full-width {
                grid-column: 1 / -1;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

function closeGoodsDetailModal() {
    document.getElementById('goodsDetailModal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    selectedGoodsId = null;
}

// ========== 导出功能 ==========
function copyFilteredRecords() {
    if (currentRecords.length === 0) {
        showMessage('没有可复制的记录', 'error');
        return;
    }
    
    let text = '货品管理记录汇总\n\n';
    text += '时间,货号,码数/款式,状态,单价,数量,总成本,运费,运费备注,实际收入,利润,提交人,备注\n';
    text += '----------------------------------------------------------------------------------------------------------------------\n';
    
    currentRecords.forEach(record => {
        text += `${formatDateTime(record.created_at)},`;
        text += `${record.goods_id},`;
        text += `${record.goods_name || ''},`;
        text += `${record.status},`;
        text += `${record.unit_price.toFixed(2)},`;
        text += `${record.quantity},`;
        text += `${record.total_cost.toFixed(2)},`;
        text += `${record.shipping_fee.toFixed(2)},`;
        text += `${record.shipping_note || ''},`;
        text += `${record.actual_income ? record.actual_income.toFixed(2) : ''},`;
        text += `${record.profit ? record.profit.toFixed(2) : ''},`;
        text += `${record.submitter},`;
        text += `${record.remark || ''}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        showMessage('✅ 所有记录已复制到剪贴板，可粘贴到Excel中', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showMessage('❌ 复制失败，请手动选择并复制', 'error');
    });
}

function exportToExcel() {
    if (currentRecords.length === 0) {
        showMessage('没有可导出的记录', 'error');
        return;
    }
    
    let csv = '时间,货号,码数/款式,状态,单价,数量,总成本,运费,运费备注,实际收入,利润,提交人,备注\n';
    
    currentRecords.forEach(record => {
        csv += `"${formatDateTime(record.created_at)}",`;
        csv += `"${record.goods_id}",`;
        csv += `"${record.goods_name || ''}",`;
        csv += `"${record.status}",`;
        csv += `"${record.unit_price.toFixed(2)}",`;
        csv += `"${record.quantity}",`;
        csv += `"${record.total_cost.toFixed(2)}",`;
        csv += `"${record.shipping_fee.toFixed(2)}",`;
        csv += `"${record.shipping_note || ''}",`;
        csv += `"${record.actual_income ? record.actual_income.toFixed(2) : ''}",`;
        csv += `"${record.profit ? record.profit.toFixed(2) : ''}",`;
        csv += `"${record.submitter}",`;
        csv += `"${record.remark || ''}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `货品记录_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('✅ Excel文件已生成，正在下载...', 'success');
}

function printRecords() {
    const printStyle = document.createElement('style');
    printStyle.textContent = `
        @media print {
            body * {
                visibility: hidden;
            }
            .container, .container * {
                visibility: visible;
            }
            .container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                box-shadow: none;
            }
            .role-switch, .btn, .pagination, .export-actions {
                display: none !important;
            }
            .record-item {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
    `;
    
    document.head.appendChild(printStyle);
    window.print();
    document.head.removeChild(printStyle);
}

// ========== 批量操作 ==========
function batchDeleteRecords() {
    showMessage('批量删除功能开发中...', 'info');
}

// ========== 工具函数 ==========
// 显示消息
function showMessage(text, type) {
    const messageBox = document.getElementById('formMessage');
    messageBox.textContent = text;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    
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
console.log('货品管理账本专业版已加载');
// 如果原代码中缺少这些函数，临时添加
// 创建单个记录项的HTML
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
    
    const compactClass = compact ? 'compact' : '';
    
    return `
        <div class="record-item ${statusClass} ${compactClass}">
            <div class="record-header">
                <div class="record-title">
                    <i class="fas fa-barcode"></i> ${record.goods_id}
                    ${record.goods_name && record.goods_name !== record.goods_id ? 
                        `<span class="record-subtitle">${record.goods_name}</span>` : ''}
                </div>
                <div class="record-status ${statusClass}">${record.status}</div>
            </div>
            
            <div class="record-body">
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
                    <span><i class="fas fa-user"></i> ${record.submitter}</span>
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
// ========== 显示记录函数 ==========
function displayRecords(records) {
    const recordsList = document.getElementById('recordsList');
    const emptyMessage = document.getElementById('emptyMessage');
    
    if (!recordsList) return;
    
    if (!records || records.length === 0) {
        recordsList.innerHTML = '';
        if (emptyMessage) emptyMessage.style.display = 'block';
        return;
    }
    
    if (emptyMessage) emptyMessage.style.display = 'none';
    
    let html = '';
    
    // 按日期分组
    const groupedByDate = {};
    records.forEach(record => {
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