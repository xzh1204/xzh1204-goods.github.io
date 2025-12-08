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
    initApp();
});

// 初始化应用
function initApp() {
    // 获取Supabase客户端
    supabase = window.supabaseClient;
    
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
    document.getElementById('calcShippingBtn').addEventListener('click', calculateShipping);
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
        option.textContent = `${goodsId} - ${goodsTemplates[goodsId].name || '未命名'}`;
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
        document.getElementById('goodsName').value = '';
        showMessage('未找到该货号的模板，请输入商品名称', 'info');
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
    document.getElementById('goodsName').value = template.name || '';
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
    document.getElementById('goodsName').value = record.goods_name || '';
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
        if (