class ReachinboxApp {
    constructor() {
        // Initialize socket if available, otherwise use null
        this.socket = typeof io !== 'undefined' ? io() : null;
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 1;
        this.currentFilters = {};
        this.currentEmail = null;
        
        this.initializeEventListeners();
        this.loadInitialData();
        this.setupSocketListeners();
    }

    initializeEventListeners() {
        // Search functionality
        document.getElementById('search-input').addEventListener('input', 
            this.debounce(() => this.searchEmails(), 500)
        );

        // Filter changes
        document.getElementById('account-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('category-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('folder-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('date-from').addEventListener('change', () => this.applyFilters());
        document.getElementById('date-to').addEventListener('change', () => this.applyFilters());

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => this.clearFilters());

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => this.previousPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadEmails());

        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => this.closeEmailModal());
        document.getElementById('close-ai-modal').addEventListener('click', () => this.closeAIModal());
        document.getElementById('suggest-reply').addEventListener('click', () => this.openAIModal());
        document.getElementById('regenerate-reply').addEventListener('click', () => this.generateAIReply());
        document.getElementById('copy-reply').addEventListener('click', () => this.copyAIReply());

        // Click outside modal to close
        document.getElementById('email-modal').addEventListener('click', (e) => {
            if (e.target.id === 'email-modal') this.closeEmailModal();
        });
        document.getElementById('ai-reply-modal').addEventListener('click', (e) => {
            if (e.target.id === 'ai-reply-modal') this.closeAIModal();
        });
    }

    setupSocketListeners() {
        if (!this.socket) {
            // Demo mode - no socket available
            this.updateConnectionStatus(true);
            return;
        }

        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.socket.emit('join-email-updates');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });

        this.socket.on('new-email', (email) => {
            this.showNotification(`New email: ${email.subject}`, 'info');
            this.loadEmails(); // Refresh the list
        });
    }

    async loadInitialData() {
        await Promise.all([
            this.loadEmails(),
            this.loadStats(),
            this.loadAccounts(),
            this.loadFolders()
        ]);
    }

    async loadEmails() {
        this.showLoading(true);
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                size: this.pageSize,
                ...this.currentFilters
            });

            const response = await fetch(`/api/emails?${params}`);
            const data = await response.json();

            if (data.success) {
                this.displayEmails(data.data.emails);
                this.updatePagination(data.data.pagination);
                this.updateEmailCount(data.data.pagination.total);
            } else {
                this.showError('Failed to load emails');
            }
        } catch (error) {
            console.error('Error loading emails:', error);
            this.showError('Error loading emails');
        } finally {
            this.showLoading(false);
        }
    }

    async searchEmails() {
        const query = document.getElementById('search-input').value;
        this.currentFilters.query = query;
        this.currentPage = 1;
        await this.loadEmails();
    }

    async applyFilters() {
        this.currentFilters = {
            email: document.getElementById('account-filter').value,
            category: document.getElementById('category-filter').value,
            folder: document.getElementById('folder-filter').value,
            dateFrom: document.getElementById('date-from').value,
            dateTo: document.getElementById('date-to').value
        };

        // Remove empty filters
        Object.keys(this.currentFilters).forEach(key => {
            if (!this.currentFilters[key]) {
                delete this.currentFilters[key];
            }
        });

        this.currentPage = 1;
        await this.loadEmails();
    }

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('account-filter').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('folder-filter').value = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadEmails();
    }

    displayEmails(emails) {
        const emailList = document.getElementById('email-list');
        const emptyState = document.getElementById('empty-state');

        if (emails.length === 0) {
            emailList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        emailList.innerHTML = emails.map(email => this.createEmailCard(email)).join('');
    }

    createEmailCard(email) {
        const date = new Date(email.date).toLocaleDateString();
        const time = new Date(email.date).toLocaleTimeString();
        const categoryClass = `category-${email.category?.toLowerCase().replace(/\s+/g, '-') || 'not-interested'}`;
        
        return `
            <div class="email-card p-6 hover:bg-gray-50 cursor-pointer" onclick="app.openEmailModal('${email.id}')">
                <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="text-sm font-medium text-gray-900 truncate">${email.from}</span>
                            <span class="category-badge ${categoryClass}">${email.category || 'Not Categorized'}</span>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-1 truncate">${email.subject || 'No Subject'}</h3>
                        <p class="text-sm text-gray-600 mb-2 line-clamp-2">${this.stripHtml(email.text || '')}</p>
                        <div class="flex items-center text-xs text-gray-500 space-x-4">
                            <span><i class="fas fa-envelope mr-1"></i>${email.email}</span>
                            <span><i class="fas fa-folder mr-1"></i>${email.folder}</span>
                            <span><i class="fas fa-clock mr-1"></i>${date} ${time}</span>
                            ${email.attachments && email.attachments.length > 0 ? 
                                `<span><i class="fas fa-paperclip mr-1"></i>${email.attachments.length} attachment(s)</span>` : ''
                            }
                        </div>
                    </div>
                    <div class="ml-4 flex-shrink-0">
                        <i class="fas fa-chevron-right text-gray-400"></i>
                    </div>
                </div>
            </div>
        `;
    }

    async openEmailModal(emailId) {
        try {
            const response = await fetch(`/api/emails/${emailId}`);
            const data = await response.json();

            if (data.success) {
                this.currentEmail = data.data;
                this.displayEmailModal(data.data);
                document.getElementById('email-modal').classList.remove('hidden');
            } else {
                this.showError('Failed to load email details');
            }
        } catch (error) {
            console.error('Error loading email details:', error);
            this.showError('Error loading email details');
        }
    }

    displayEmailModal(email) {
        document.getElementById('modal-subject').textContent = email.subject || 'No Subject';
        document.getElementById('modal-from').textContent = email.from;
        document.getElementById('modal-to').textContent = email.to;
        document.getElementById('modal-date').textContent = new Date(email.date).toLocaleString();
        
        const categoryElement = document.getElementById('modal-category');
        categoryElement.textContent = email.category || 'Not Categorized';
        categoryElement.className = `category-badge category-${email.category?.toLowerCase().replace(/\s+/g, '-') || 'not-interested'}`;
        
        const content = document.getElementById('modal-content');
        if (email.html) {
            content.innerHTML = email.html;
        } else {
            content.innerHTML = `<pre class="whitespace-pre-wrap">${email.text || 'No content'}</pre>`;
        }
    }

    closeEmailModal() {
        document.getElementById('email-modal').classList.add('hidden');
        this.currentEmail = null;
    }

    openAIModal() {
        if (!this.currentEmail) return;
        
        document.getElementById('ai-reply-modal').classList.remove('hidden');
        document.getElementById('training-data').value = '';
        document.getElementById('ai-reply-content').innerHTML = `
            <div class="loading-spinner mx-auto mb-2"></div>
            <p class="text-gray-500 text-center">Generating reply...</p>
        `;
        
        this.generateAIReply();
    }

    closeAIModal() {
        document.getElementById('ai-reply-modal').classList.add('hidden');
    }

    async generateAIReply() {
        if (!this.currentEmail) return;

        const trainingData = document.getElementById('training-data').value;
        if (!trainingData.trim()) {
            this.showError('Please enter training data/context for the AI');
            return;
        }

        try {
            const response = await fetch('/api/ai/reply/suggest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.currentEmail,
                    trainingData: trainingData
                })
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('ai-reply-content').innerHTML = `
                    <div class="bg-white p-4 rounded border">
                        <pre class="whitespace-pre-wrap text-sm">${data.data.suggestedReply}</pre>
                    </div>
                `;
            } else {
                this.showError('Failed to generate AI reply');
            }
        } catch (error) {
            console.error('Error generating AI reply:', error);
            this.showError('Error generating AI reply');
        }
    }

    copyAIReply() {
        const replyContent = document.getElementById('ai-reply-content').textContent;
        navigator.clipboard.writeText(replyContent).then(() => {
            this.showNotification('Reply copied to clipboard!', 'success');
        }).catch(() => {
            this.showError('Failed to copy reply');
        });
    }

    async loadStats() {
        try {
            const response = await fetch('/api/emails/stats/overview');
            const data = await response.json();

            if (data.success) {
                this.updateStats(data.data);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('total-emails').textContent = stats.totalEmails || 0;
        
        const categoryStats = {};
        stats.byCategory?.forEach(cat => {
            categoryStats[cat.category] = cat.count;
        });

        document.getElementById('interested-emails').textContent = categoryStats['Interested'] || 0;
        document.getElementById('meeting-emails').textContent = categoryStats['Meeting Booked'] || 0;
        document.getElementById('not-interested-emails').textContent = categoryStats['Not Interested'] || 0;
    }

    async loadAccounts() {
        try {
            const response = await fetch('/api/emails/stats/overview');
            const data = await response.json();

            if (data.success) {
                const accountSelect = document.getElementById('account-filter');
                const accounts = data.data.byAccount || [];
                
                accountSelect.innerHTML = '<option value="">All Accounts</option>' +
                    accounts.map(account => 
                        `<option value="${account.email}">${account.email} (${account.count})</option>`
                    ).join('');
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }

    async loadFolders() {
        try {
            const response = await fetch('/api/emails/stats/folders');
            const data = await response.json();

            if (data.success) {
                const folderSelect = document.getElementById('folder-filter');
                const folders = data.data || [];
                
                folderSelect.innerHTML = '<option value="">All Folders</option>' +
                    folders.map(folder => 
                        `<option value="${folder.folder}">${folder.folder} (${folder.count})</option>`
                    ).join('');
            }
        } catch (error) {
            console.error('Error loading folders:', error);
        }
    }

    updatePagination(pagination) {
        this.currentPage = pagination.page;
        this.totalPages = pagination.pages;
        
        document.getElementById('page-info').textContent = `Page ${pagination.page} of ${pagination.pages}`;
        document.getElementById('prev-page').disabled = pagination.page <= 1;
        document.getElementById('next-page').disabled = pagination.page >= pagination.pages;
    }

    updateEmailCount(total) {
        document.getElementById('email-count').textContent = `${total} email${total !== 1 ? 's' : ''}`;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadEmails();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadEmails();
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        const indicator = statusElement.querySelector('.w-2');
        
        if (connected) {
            indicator.className = 'w-2 h-2 bg-green-500 rounded-full mr-2';
            statusElement.innerHTML = '<div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>Connected';
        } else {
            indicator.className = 'w-2 h-2 bg-red-500 rounded-full mr-2';
            statusElement.innerHTML = '<div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>Disconnected';
        }
    }

    showLoading(show) {
        const loadingState = document.getElementById('loading-state');
        const emailList = document.getElementById('email-list');
        
        if (show) {
            loadingState.classList.remove('hidden');
            emailList.style.display = 'none';
        } else {
            loadingState.classList.add('hidden');
            emailList.style.display = 'block';
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'success' ? 'bg-green-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ReachinboxApp();
});
