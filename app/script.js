
var ZAGlobal = {
    selectedRecords: [], 
    allRecords: [],
    filteredRecords: [],
    reRenderTableBody: function () {
        $('._tbody').empty();
        var tbody = '';

        if (ZAGlobal.filteredRecords.length === 0) {
            $('._tbody').html('<tr><td colspan="5">No records available to approve/reject.</td></tr>');
            return;
        }

        // Render filtered records
        ZAGlobal.filteredRecords.forEach(function (record) {
            tbody += `<tr data-id="${record.entity.id}" data-module="${record.module}">
                        <td><input type="checkbox" data-id="${record.entity.id}" data-module="${record.module}" ${ZAGlobal.selectedRecords.includes(record.entity.id) ? 'checked' : ''}></td>
                        <td>${record.entity.name}</td>
                        <td>${record.rule.name}</td>
                        <td>${record.entity.id}</td>
                        <td><div class="_status ${record.is_approved ? '_approved' : record.is_rejected ? '_rejected' : '_'}"></div></td>
                    </tr>`;
        });
        $('._tbody').append(tbody);

        // After the table, render selected records
        renderSelectedRecords();
    }
};


function renderSelectedRecords() {
    const selectedRecordsSection = document.querySelector('.selected-records-section');
    selectedRecordsSection.innerHTML = ''; // Clear previous selected records section

    if (ZAGlobal.selectedRecords.length === 0) {
        selectedRecordsSection.style.display = 'none'; // Hide if no selected records
        return;
    }

    selectedRecordsSection.style.display = 'block'; // Show section for selected records

    var selectedRecordsHTML = '<tr><td colspan="5" class="selected-records-header">Selected Records</td></tr>';

    ZAGlobal.selectedRecords.forEach(function (recordId) {
        const record = ZAGlobal.allRecords.find(r => r.entity.id == recordId);
        if (record) {
            selectedRecordsHTML += `<tr class="selected-record">
                                        <td><input type="checkbox" data-id="${record.entity.id}" data-module="${record.module}" checked disabled></td>
                                        <td>${record.entity.name}</td>
                                        <td>${record.rule.name}</td>
                                        <td>${record.entity.id}</td>
                                        <td><div class="_status ${record.is_approved ? '_approved' : record.is_rejected ? '_rejected' : '_'}"></div></td>
                                    </tr>`;
        }
    });

    selectedRecordsSection.innerHTML = selectedRecordsHTML;
}

// Show the popup when the button is clicked
document.getElementById('searchbtn').addEventListener('click', () => {
    document.getElementById('search_popup').style.display = 'flex';
});

// Close the popup when the close button is clicked
document.getElementById('close_PopupBtn').addEventListener('click', () => {
    document.getElementById('search_popup').style.display = 'none';
});

// Close the popup if the user clicks outside of the popup
window.addEventListener('click', (event) => {
    if (event.target === document.getElementById('search_popup')) {
        document.getElementById('search_popup').style.display = 'none';
    }
});

document.getElementById('doneBtn').addEventListener('click', () => {
    const selectedModule = document.getElementById('module').value;
    filterRecordsByModule(selectedModule);  
    document.getElementById('search_popup').style.display = 'none';  // Close the popup after done
});

document.getElementById('resetTableBtn').addEventListener('click', () => {
    ZAGlobal.filteredRecords = ZAGlobal.allRecords;  // Reset to all records
    ZAGlobal.reRenderTableBody();  
    document.getElementById('search_popup').style.display = 'none';  
});

ZOHO.embeddedApp.on("PageLoad", function (data) {
    if (data && data.Entity) {
        ZAGlobal.module = data.Entity;
        ZOHO.CRM.API.getApprovalRecords({ type: "awaiting" })
            .then(function (toBeApproved) {
                ZAGlobal.filteredRecords = toBeApproved.data;
                ZAGlobal.allRecords = [...toBeApproved.data];

                ZAGlobal.reRenderTableBody(); // Initial render
            })
            .catch(function (error) {
                console.log('Error fetching records:', error);
            });

        ZOHO.CRM.META.getModules().then(function (data) {
            if (data && Array.isArray(data.modules)) {
                populateModules(data.modules);
            }
        });
    }
});

// Function to populate the module select dropdown
function populateModules(modules) {
    const select = document.getElementById('module');
    select.innerHTML = '<option value="">Search in Specific Module</option>';
    modules.forEach(module => {
        const option = document.createElement('option');
        option.value = module.api_name;
        option.textContent = module.api_name;
        select.appendChild(option);
    });

    $('#module').select2({ placeholder: "Select a module", allowClear: true });

    // Handle change in module selection
    select.addEventListener('change', function () {
        filterRecordsByModule(select.value);
        reSelectPreviousSelections(select.value);
    });
}

// Function to filter records based on selected module
function filterRecordsByModule(selectedModule) {
    if (selectedModule === "") {
        ZAGlobal.filteredRecords = ZAGlobal.allRecords;
    } else {
        ZAGlobal.filteredRecords = ZAGlobal.allRecords.filter(record => record.module === selectedModule);
    }
    ZAGlobal.reRenderTableBody();
}

// Function to re-select previously selected records after switching modules
function reSelectPreviousSelections(selectedModule) {
    const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    rowCheckboxes.forEach(checkbox => checkbox.checked = false); // Deselect all checkboxes

    // Re-select previously selected records for the new module
    ZAGlobal.selectedRecords.forEach(selectedId => {
        rowCheckboxes.forEach(checkbox => {
            if (checkbox.dataset.id == selectedId && checkbox.dataset.module === selectedModule) {
                checkbox.checked = true;
            }
        });
    });
}

// Event listener for checkbox change (record selection)
document.querySelector('tbody').addEventListener('change', function (event) {
    if (event.target.type === 'checkbox') {
        const recordId = event.target.dataset.id;
        if (event.target.checked) {
            ZAGlobal.selectedRecords.push(recordId);
        } else {
            const index = ZAGlobal.selectedRecords.indexOf(recordId);
            if (index > -1) {   
                ZAGlobal.selectedRecords.splice(index, 1);
            }
        }
        ZAGlobal.reRenderTableBody();
    }
});

// Button action for approve/reject
ZAGlobal.buttonAction = function (action) {
    const checkedRecords = ZAGlobal.selectedRecords.length;
    if (checkedRecords === 0) {
        alert('Please select at least one record to approve/reject.');
        return;
    }

    if (action === 'reject') {
        const comments = $('._comments').val() || $('._comments').text();
        if (!comments || comments.trim() === '') {
            alert('Please provide the reason for rejecting.');
            return;
        }
    }

    let approvedRecordsCount = 0;
    let rejectedRecordsCount = 0;

    ZAGlobal.selectedRecords.forEach(function (recordId) {
        const record = ZAGlobal.filteredRecords.find(rec => rec.entity.id == recordId);
        if (record) {
            var config = {
                Entity: record.module,
                RecordID: record.entity.id,
                actionType: action
            };

            if (action === 'reject') {
                const comments = $('._comments').val() || $('._comments').text().trim();
                config.comments = comments;
            }

            ZOHO.CRM.API.approveRecord(config).then(function (data) {
                if (action === 'approve') {
                    record.is_approved = true;
                    approvedRecordsCount++;
                } else if (action === 'reject') {
                    record.is_rejected = true;
                    rejectedRecordsCount++;
                }
            }).catch(function (error) {
                console.log('Error processing record:', error);
            });
        }
    });

    // Update the table after action
    var intervalId = setInterval(function () {
        if (checkedRecords === (approvedRecordsCount + rejectedRecordsCount)) {
            ZAGlobal.reRenderTableBody();
            ZAGlobal.triggerAppRejToast(action, approvedRecordsCount, rejectedRecordsCount);
            clearInterval(intervalId);
        }
    }, 100);
};

// Function to trigger toast notifications for actions
ZAGlobal.triggerAppRejToast = function (action, approvedRecordsCount, rejectedRecordsCount) {
    Toastify({
        text: `${action === 'approve' ? approvedRecordsCount : rejectedRecordsCount} records were ${action === 'approve' ? 'approved' : 'rejected'}`,
        duration: 3000,
        gravity: "top", // top or bottom
        position: "center", // left, center or right
        stopOnFocus: true,
        onClick: function () {}
    }).showToast();
};

// Search functionality to filter the table rows
document.getElementById('searchBar').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('tbody tr');

    rows.forEach(function (row) {
        const columns = row.querySelectorAll('td');
        let matchFound = false;

        columns.forEach(function (column) {
            if (column.textContent.toLowerCase().includes(searchValue)) {
                matchFound = true;
            }
        });

        if (matchFound) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

ZAGlobal.selectAll = function () {
    const headerCheckbox = document.querySelector('thead input[type="checkbox"]');
    const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');

    headerCheckbox.addEventListener('change', () => {
        rowCheckboxes.forEach(checkbox => {
            checkbox.checked = headerCheckbox.checked;
            const recordId = checkbox.dataset.id;
            if (checkbox.checked) {
                if (!ZAGlobal.selectedRecords.includes(recordId)) {
                    ZAGlobal.selectedRecords.push(recordId);
                }
            } else {
                const index = ZAGlobal.selectedRecords.indexOf(recordId);
                if (index > -1) {
                    ZAGlobal.selectedRecords.splice(index, 1);
                }
            }
        });
        ZAGlobal.reRenderTableBody();
    });
};


ZOHO.embeddedApp.init().then(function() {
    ZOHO.CRM.CONFIG.getCurrentUser().then(function(data) {
        var userLanguage = data.users[0].locale;

        if(userLanguage === 'zh_CN') {
            loadChineseTranslations();
        } else {
            loadEnglishTranslations();  
        }

    }).catch(function(error) {
        console.error('Error fetching current user:', error);
    });
}).catch(function(error) {
    console.error('Error initializing SDK:', error);
});

function loadEnglishTranslations() {
    console.log("Defualt eng lan");
}

function loadChineseTranslations() {
    console.log("Loading Chinese translations...");
    document.getElementById('searchBar').placeholder = "搜索";
    document.getElementById('searchbtn').innerText = "搜索";
    document.getElementById('resetTableBtn').innerText = "重置";
    document.querySelector('.approve').innerText = "批准";
    document.querySelector('.reject').innerText = "拒绝";
    document.querySelector('._comments').placeholder = "评论";
    document.getElementById('recordNameHeader').innerText = "记录名称";
    document.getElementById('approvalProcessNameHeader').innerText = "审批流程名称";
    document.getElementById('recordIdHeader').innerText = "记录ID";
    document.getElementById('statusHeader').innerText = "状态";
    document.getElementById('doneBtn').innerText = "完毕";
    document.getElementById('cancelBtn').innerText = "取消";
    document.querySelector('.moduleclass').innerHTML = "选择特定模块";
    document.getElementById('popup_header').innerText = "过滤器列表";

}
ZOHO.embeddedApp.init();
