var ZAGlobal = {
    selectedRecords: [],
    allRecords: [],
    filteredRecords: [],
    processedRecords: [],   
    waitingRecords: [],
    recordsPerPage: 10,
    currentPage: 1,
    totalPages: 0,

    reRenderTableBody: function () {
        $('._tbody').empty();
        var tbody = '';

        // Render filtered records in the main table
        if (ZAGlobal.filteredRecords.length === 0 && ZAGlobal.processedRecords.length === 0) {
            $('._tbody').html('<tr><td colspan="5">No records available to approve/reject.</td></tr>');
        } else {
            // Apply pagination
            var startIndex = (ZAGlobal.currentPage - 1) * ZAGlobal.recordsPerPage;
            var endIndex = startIndex + ZAGlobal.recordsPerPage;
            var recordsToShow = ZAGlobal.filteredRecords.slice(startIndex, endIndex);
            // var allRecordsToShow = recordsToShow.concat(ZAGlobal.processedRecords);

            recordsToShow.forEach(function (record) {
                tbody += `<tr data-id="${record.entity.id}" data-module="${record.module}">
                            <td><input type="checkbox" data-id="${record.entity.id}" data-module="${record.module}" ${ZAGlobal.selectedRecords.includes(record.entity.id) ? 'checked' : ''}></td>
                            <td>${record.entity.name}</td>
                            <td>${record.rule.name}</td>
                            <td>${record.module}</td>
                            <td>${record.entity.id}</td>
                            <td><div class="_status ${record.is_approved ? '_approved' : record.is_rejected ? '_rejected' : '_'}"></div></td>
                        </tr>`;                        
            });

            ZAGlobal.processedRecords.forEach(function (record) {
                tbody += `<tr data-id="${record.entity.id}" data-module="${record.module}">
                        <td><input type="checkbox" data-id="${record.entity.id}" data-module="${record.module}" ${ZAGlobal.selectedRecords.includes(record.entity.id) ? 'checked' : ''} disabled class="disabled-checkbox"></td>
                            <td>${record.entity.name}</td>
                            <td>${record.rule.name}</td>
                            <td>${record.module}</td>
                            <td>${record.entity.id}</td>
                            <td><div class="_status ${record.is_approved ? '_approved' : record.is_rejected ? '_rejected' : '_'}"></div></td>
                        </tr>`;
            });
            
            $('._tbody').append(tbody);
        }
        ZAGlobal.updatePagination();
        ZAGlobal.selectAll();   
    },

    updatePagination: function () {
        var totalRecords = ZAGlobal.filteredRecords.length;
        ZAGlobal.totalPages = Math.ceil(totalRecords / ZAGlobal.recordsPerPage);
        
        var paginationHtml = `
            <select id="recordsPerPage">
                <option value="10" ${ZAGlobal.recordsPerPage === 10 ? 'selected' : ''}>10 Records per page</option>
                <option value="20" ${ZAGlobal.recordsPerPage === 20 ? 'selected' : ''}>20 Records per page</option>
                <option value="30" ${ZAGlobal.recordsPerPage === 30 ? 'selected' : ''}>30 Records per page</option>
                <option value="40" ${ZAGlobal.recordsPerPage === 40 ? 'selected' : ''}>40 Records per page</option>
                <option value="50" ${ZAGlobal.recordsPerPage === 50 ? 'selected' : ''}>50 Records per page</option>
                <option value="100" ${ZAGlobal.recordsPerPage === 100 ? 'selected' : ''}>100 Records per page</option>
            </select>
            <button id="prevPageBtn" ${ZAGlobal.currentPage === 1 ? 'disabled' : ''}> Prev</button>
            <span>Page ${ZAGlobal.currentPage} - ${ZAGlobal.totalPages}</span>
            <button id="nextPageBtn" ${ZAGlobal.currentPage === ZAGlobal.totalPages ? 'disabled' : ''}>Next </button>
        `;
        $('#paginationFooter').html(paginationHtml);
        ZAGlobal.bindPaginationEvents();
    },

    bindPaginationEvents: function () {
        $('#recordsPerPage').on('change', function () {
            ZAGlobal.recordsPerPage = parseInt(this.value);
            ZAGlobal.currentPage = 1;
            ZAGlobal.reRenderTableBody();
        });

        $('#prevPageBtn').on('click', function () {
            if (ZAGlobal.currentPage > 1) {
                ZAGlobal.currentPage--;
                ZAGlobal.reRenderTableBody();
            }
        });

        $('#nextPageBtn').on('click', function () {
            if (ZAGlobal.currentPage < ZAGlobal.totalPages) {
                ZAGlobal.currentPage++;
                ZAGlobal.reRenderTableBody();
            }
        });
    }
};



// Button action for approve/reject
ZAGlobal.buttonAction = async function (action) {
    const checkedRecords = ZAGlobal.selectedRecords.length;
    if (checkedRecords === 0) {
        ZAGlobal.triggerWarning('Please select at least one record to approve/reject.', 3000, 'warning');
        return;
    }

    if (action === 'reject') {
        const comments = $('._comments').val() || $('._comments').text();
        if (!comments || comments.trim() === '') {
            ZAGlobal.triggerWarning('Please provide the reason for rejecting.', 3000, 'warning');
            return;
        }
    }

    let approvedRecordsCount = 0;
    let rejectedRecordsCount = 0;

    for (const recordId of ZAGlobal.selectedRecords) {
        const record = ZAGlobal.waitingRecords.find(rec => rec.entity.id == recordId);
        if (record) {
            const config = {
                Entity: record.module,
                RecordID: record.entity.id,
                actionType: action
            };  

            if (action === 'reject') {
                const comments = $('._comments').val() || $('._comments').text().trim();
                config.comments = comments;
            }

            try {
                let res = await ZOHO.CRM.API.approveRecord(config);
                if (!res) throw new Error('Error processing the record');

                // Move processed records to the processed list
                if (action === 'approve') {
                    record.is_approved = true;
                    approvedRecordsCount++;
                } else if (action === 'reject') {
                    record.is_rejected = true;
                    rejectedRecordsCount++;
                }

                // Remove from waiting records and add to processed records
                ZAGlobal.waitingRecords = ZAGlobal.waitingRecords.filter(r => r.entity.id !== record.entity.id);
                ZAGlobal.filteredRecords = ZAGlobal.filteredRecords.filter(r => r.entity.id !== record.entity.id);
                
                ZAGlobal.processedRecords.push(record);
                // Re-render the table to update
                ZAGlobal.reRenderTableBody();
            } catch (error) {
                console.log('Error processing record:', error);
            }
        }
    }
    if (checkedRecords === (approvedRecordsCount + rejectedRecordsCount)) {
        ZAGlobal.triggerAppRejToast(action, approvedRecordsCount, rejectedRecordsCount);
    }
    $('._comments').val('');  
};

ZAGlobal.triggerAppRejToast = function (action, approvedRecordsCount, rejectedRecordsCount) {
    const backgroundColor = action === 'approve' ? '#4CAF50' : '#F44336'; // Green for approve, Red for reject
    Toastify({
        text: `${action === 'approve' ? approvedRecordsCount : rejectedRecordsCount} records were ${action === 'approve' ? 'approved' : 'rejected'}`,
        duration: 3000,
        gravity: "top", 
        position: "center",
        backgroundColor: backgroundColor, 
        stopOnFocus: true,
        onClick: function () {}
    }).showToast();
};

// Show the popup when the button is clicked
document.getElementById('searchbtn').addEventListener('click', () => {
    document.getElementById('search_popup').style.display = 'flex';
});

// Close the popup when the close button is clicked
document.getElementById('cancelBtn').addEventListener('click', () => {
    document.getElementById('search_popup').style.display = 'none';
});

// Close the popup if the user clicks outside of the popup
window.addEventListener('click', (event) => {
    if (event.target === document.getElementById('search_popup')) {
        document.getElementById('search_popup').style.display = 'none';
    }
});

document.getElementById('doneBtn').addEventListener('click', () => {
    const selectedModule = $('#module').val();
    if (selectedModule.length === 0) {
        ZAGlobal.triggerWarning('Please select at least one module' , 3000, 'warning');
        return;
    }
    filterRecordsByModule(selectedModule);
    document.getElementById('search_popup').style.display = 'none'; // Close the popup after done
});

// Handle Clear button click (reset the selection)
document.getElementById('clearBtn').addEventListener('click', () => {
    $('#module').val([]).trigger('change'); // Clear all selections in select2
    updateSelectedModules(); // Update the display
});

// Reset button action
document.getElementById('resetTableBtn').addEventListener('click', () => {
    ZAGlobal.filteredRecords = ZAGlobal.allRecords.filter(record => !ZAGlobal.processedRecords.some(proc => proc.entity.id === record.entity.id));
    ZAGlobal.selectedRecords = [];
    ZAGlobal.recordsPerPage = [10];
    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    ZAGlobal.reRenderTableBody();  
    document.getElementById('search_popup').style.display = 'none';  
});
// document.getElementById('resetTableBtn').addEventListener('click', () => {
//     ZAGlobal.filteredRecords = ZAGlobal.allRecords;  // Reset to all records
//     ZAGlobal.reRenderTableBody();  
//     document.getElementById('search_popup').style.display = 'none';  
// });

ZOHO.embeddedApp.on("PageLoad", function (data) {
    // if (data && data.Entity) {
        ZAGlobal.module = data.Entity;
        ZOHO.CRM.API.getApprovalRecords({ type: "awaiting" })
            .then(function (toBeApproved) {
                ZAGlobal.filteredRecords = toBeApproved.data;
                ZAGlobal.allRecords = [...toBeApproved.data];
                ZAGlobal.waitingRecords = [...toBeApproved.data];
                ZAGlobal.reRenderTableBody(); 
            })
            .catch(function (error) {
                console.log('Error fetching records:', error);
            });

        ZOHO.CRM.META.getModules().then(function (data) {
            if (data && Array.isArray(data.modules)) {
                populateModules(data.modules);
            }
        });
    // }
});

// Function to populate the module select dropdown
function populateModules(modules) {
    const select = document.getElementById('module');
    select.innerHTML =  '';
    select.style.width = '270px';
    modules.forEach(module => {
        const option = document.createElement('option');
        option.value = module.api_name;
        option.textContent = module.api_name;
        select.appendChild(option);
    });

    $('#module').select2({allowClear: true, placeholder: "Select Modules"});
    
    $('#module').on('change', function() {
        updateSelectedModules();
    });
    

    // Handle change in module selection
    select.addEventListener('change', function () {
        filterRecordsByModule(select.value);
        reSelectPreviousSelections(select.value);
    });
}

ZAGlobal.triggerWarning = function (message, duration = 3000, type = 'info') {
    Toastify({
        text: message,
        duration: duration,
        gravity: "top", 
        position: "center", 
        stopOnFocus: true,
        backgroundColor: type === 'warning' ? '#FFA500' : (type === 'success' ? '#4CAF50' : '#2196F3'),
        onClick: function () {}
    }).showToast();
};

function updateSelectedModules() {
    const selectedModules = $('#module').val(); // Get selected modules

    if (selectedModules.length > 5) {
        selectedModules.splice(5); 
        $('#module').val(selectedModules).trigger('change');
        ZAGlobal.triggerWarning('You can select up to 5 modules only!', 3000, 'warning');
    }

    // Update the selected modules display
    const selectedModulesDiv = document.querySelector('.selected-modules');
    selectedModulesDiv.innerHTML = ''; 
    if (selectedModules.length > 0) {
        selectedModules.forEach(module => {
            const moduleItem = document.createElement('div');
            moduleItem.classList.add('module-item');
            moduleItem.textContent = module;
            
            const removeIcon = document.createElement('span');
            removeIcon.classList.add('remove-module');
            removeIcon.textContent = 'x';
            removeIcon.addEventListener('click', function() {
                const index = selectedModules.indexOf(module);
                if (index > -1) {
                    selectedModules.splice(index, 1);
                    $('#module').val(selectedModules).trigger('change'); 
                }
            });
            moduleItem.appendChild(removeIcon);
            selectedModulesDiv.appendChild(moduleItem);
        });

        // If more than one module is selected, show the "X & N more" format
        // if (selectedModules.length > 1) {
        //     const remaining = selectedModules.length - 1;
        //     const lastModuleItem = selectedModulesDiv.lastChild;
        //     lastModuleItem.textContent = selectedModules[0] + " & " + remaining + " more"; // Update the last item
        //     lastModuleItem.appendChild(removeIcon); // Add 'x' back to the last item
        // }
    }
}


// Function to filter records based on selected module
function filterRecordsByModule(selectedModules) {
    if (selectedModules.length === 0) {
        ZAGlobal.filteredRecords = ZAGlobal.allRecords;
    } else {
        ZAGlobal.filteredRecords = ZAGlobal.allRecords.filter(record => selectedModules.includes(record.module));
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
    const headerCheckbox = document.querySelector('#selectAllCheckbox'); 
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

    updateHeaderCheckboxState(rowCheckboxes, headerCheckbox);
};

function updateHeaderCheckboxState(rowCheckboxes, headerCheckbox) {
    const checkedCheckboxes = Array.from(rowCheckboxes).filter(checkbox => checkbox.checked);
    
    // If all checkboxes are checked, set the header checkbox to checked
    if (checkedCheckboxes.length === rowCheckboxes.length) {
        headerCheckbox.checked = true;
        headerCheckbox.indeterminate = false; 
    }
    // If no checkboxes are checked, set the header checkbox to unchecked
    else if (checkedCheckboxes.length === 0) {
        headerCheckbox.checked = false;
        headerCheckbox.indeterminate = false; 
    }
    // If some checkboxes are checked, set the header checkbox to indeterminate
    else {
        headerCheckbox.checked = false;
        headerCheckbox.indeterminate = true;  
    }
}

document.querySelector('tbody').addEventListener('change', function (event) {
    if (event.target.type === 'checkbox') {
        const recordId = event.target.dataset.id;
        // Add or remove the record from selectedRecords based on checkbox state
        if (event.target.checked) {
            ZAGlobal.selectedRecords.push(recordId);
        } else {
            const index = ZAGlobal.selectedRecords.indexOf(recordId);
            if (index > -1) {
                ZAGlobal.selectedRecords.splice(index, 1);
            }
        }

        ZAGlobal.reRenderTableBody(); 
        const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
        const headerCheckbox = document.querySelector('#selectAllCheckbox');
        updateHeaderCheckboxState(rowCheckboxes, headerCheckbox);
    }
});

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
    document.getElementById('clearBtn').innerText = "取消";
    document.querySelector('.moduleclass').innerHTML = "选择特定模块";
    document.getElementById('popup_header').innerText = "过滤器列表";
}
