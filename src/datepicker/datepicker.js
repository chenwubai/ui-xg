/**
 * datepicker
 * datepicker directive
 * Author: yjy972080142@gmail.com
 * Date:2016-03-21
 */
angular.module('ui.xg.datepicker', ['ui.xg.calendar', 'ui.xg.position'])
    .constant('uixDatepickerConfig', {
        minDate: null, // 最小可选日期
        maxDate: null, // 最大可选日期
        exceptions: [],  // 不可选日期中的例外,比如3月份的日期都不可选,但是3月15日却是可选择的
        format: 'yyyy-MM-dd hh:mm:ss', // 日期格式化
        autoClose: true, // 是否自动关闭面板,
        clearBtn: false,
        showTime: true,
        size: 'md'
    })
    .service('uixDatepickerService', ['$document', function ($document) {
        var openScope = null;
        this.open = function (datepickerScope) {
            if (!openScope) {
                $document.on('click', closeDatepicker);
            }
            if (openScope && openScope !== datepickerScope) {
                openScope.showCalendar = false;
            }
            openScope = datepickerScope;
        };

        this.close = function (datepickerScope) {
            if (openScope === datepickerScope) {
                openScope = null;
                $document.off('click', closeDatepicker);
            }
        };

        function closeDatepicker(evt) {
            if (!openScope) {
                return;
            }
            var panelElement = openScope.getCanledarElement();
            var toggleElement = openScope.getToggleElement();
            if (panelElement && panelElement[0].contains(evt.target) ||
                toggleElement && toggleElement[0].contains(evt.target) ||
                angular.element(evt.target).hasClass('uix-cal-day-inner') || // 选择下一个月的时候,会重新绘制日历面板,contains方法无效
                angular.element(evt.target).hasClass('uix-cal-day')
            ) {
                return;
            }
            openScope.showCalendar = false;
            openScope.$apply();
        }

    }])
    .controller('uixDatepickerCtrl',
        ['$scope', '$element', '$compile', '$attrs', '$log', 'dateFilter', '$uixPosition',
            'uixDatepickerService', 'uixDatepickerConfig', '$parse',
            function ($scope, $element, $compile, $attrs, $log, dateFilter, $uixPosition,
                      uixDatepickerService, uixDatepickerConfig, $parse) {
                var ngModelCtrl = {$setViewValue: angular.noop};
                var self = this;
                var template = '<div class="uix-datepicker-popover popover" ng-class="{in:showCalendar}">' +
                    '<div class="arrow"></div>' +
                    '<div class="popover-inner">' +
                    '<uix-calendar ng-model="selectDate" ng-if="showCalendar" on-change="changeDateHandler" ' +
                    'exceptions="exceptions" min-date="minDate" max-date="maxDate" show-time="showTime">' +
                    '</uix-calendar>' +
                    '</div></div>';
                this.init = function (_ngModelCtrl) {
                    ngModelCtrl = _ngModelCtrl;
                    ngModelCtrl.$render = this.render;
                    ngModelCtrl.$formatters.unshift(function (modelValue) {
                        return modelValue ? new Date(modelValue) : null;
                    });
                    var calendarDOM = $compile(template)($scope);
                    $element.after(calendarDOM);
                };
                $scope.showCalendar = false;
                this.toggle = function (open) {
                    var show = arguments.length ? !!open : !$scope.showCalendar;
                    if (show) {
                        adjustPosition();
                    }
                    $scope.showCalendar = show;
                };
                function adjustPosition() {
                    var popoverEle = $element.next('.uix-datepicker-popover');
                    var elePosition = $uixPosition.positionElements($element, popoverEle, 'auto bottom-left');
                    popoverEle.removeClass('top bottom');
                    if (elePosition.placement.indexOf('top') !== -1) {
                        popoverEle.addClass('top');
                    } else {
                        popoverEle.addClass('bottom');
                    }
                    popoverEle.css({
                        top: elePosition.top + 'px',
                        left: elePosition.left + 'px'
                    });
                }

                this.showCalendar = function () {
                    return $scope.showCalendar;
                };
                angular.forEach(['exceptions', 'clearBtn', 'showTime'], function (key) {
                    $scope[key] = angular.isDefined($attrs[key])
                        ? angular.copy($scope.$parent.$eval($attrs[key])) : uixDatepickerConfig[key];
                });

                // format
                var format = uixDatepickerConfig.format;
                if ($attrs.format) {
                    $scope.$parent.$watch($parse($attrs.format), function (value) {
                        format = value;
                        $scope.inputValue = dateFilter($scope.selectDate, format);
                    });
                }

                this.render = function () {
                    var date = ngModelCtrl.$modelValue;
                    if (isNaN(date)) {
                        $log.warn('Datepicker directive: "ng-model" value must be a Date object, ' +
                            'a number of milliseconds since 01.01.1970 or a string representing an RFC2822 ' +
                            'or ISO 8601 date.');
                    }
                    $scope.selectDate = date;
                    $scope.inputValue = dateFilter(date, format);
                };
                // 显示隐藏日历
                $scope.toggleCalendarHandler = function (evt) {
                    $element.find('input')[0].blur();
                    if (evt) {
                        evt.preventDefault();
                    }
                    if (!$scope.isDisabled) {
                        self.toggle();
                    }
                };

                // 获取日历面板和被点击的元素
                $scope.getCanledarElement = function () {
                    return $element.next('.uix-datepicker-popover');
                };
                $scope.getToggleElement = function () {
                    return angular.element($element[0].querySelector('.input-group'));
                };
                // 清除日期
                $scope.clearDateHandler = function () {
                    $scope.inputValue = null;
                    $scope.selectDate = null;
                    ngModelCtrl.$setViewValue(null);
                    ngModelCtrl.$render();
                };
                $scope.$watch('showCalendar', function (showCalendar) {
                    if (showCalendar) {
                        uixDatepickerService.open($scope);
                    } else {
                        uixDatepickerService.close($scope);
                    }
                });

                var autoClose = angular.isDefined($attrs.autoClose)
                    ? $scope.$parent.$eval($attrs.autoClose) : uixDatepickerConfig.autoClose;
                // 选择日期
                $scope.changeDateHandler = function (date) {
                    $scope.inputValue = dateFilter(date, format);
                    $scope.selectDate = date;
                    if (autoClose) {
                        self.toggle();
                    }
                    ngModelCtrl.$setViewValue(date);
                    ngModelCtrl.$render();

                    var fn = $scope.onChange ? $scope.onChange() : angular.noop();
                    if (angular.isDefined(fn)) {
                        fn();
                    }
                };
                $scope.$on('$locationChangeSuccess', function () {
                    $scope.showCalendar = false;
                });

            }])
    .directive('uixDatepicker', function () {
        return {
            restrict: 'AE',
            templateUrl: 'templates/datepicker.html',
            replace: true,
            require: ['uixDatepicker', 'ngModel'],
            scope: {
                minDate: '=?',
                maxDate: '=?',
                placeholder: '@',
                size: '@',
                isDisabled: '=?ngDisabled',
                onChange: '&?'
            },
            controller: 'uixDatepickerCtrl',
            link: function (scope, el, attrs, ctrls) {
                var datepickerCtrl = ctrls[0],
                    ngModelCtrl = ctrls[1];
                datepickerCtrl.init(ngModelCtrl);
            }
        };
    });
