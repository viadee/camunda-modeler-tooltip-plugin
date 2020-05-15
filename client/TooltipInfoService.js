
'use strict';
var $ = require('jquery');
var _ = require('lodash');


// start-up behaviour (> 'npm run bundle' afterwards)
//   true: tooltip-plugin  enabled at start-up
//  false: tooltip-plugin disabled at start-up
var TOOLTIP_INFOS_ENABLED = true;


function TooltipInfoService(eventBus, overlays, elementRegistry, editorActions) {

  // register 'toggleTooltipInfos'-event
  editorActions.register({
    toggleTooltipInfos: function () {
      toggleTooltipInfos();
    }
  });

  // refresh tooltips on various events
  eventBus.on('shape.added', function () { _.defer(function () { refresh(); }); });
  eventBus.on('element.changed', function () { _.defer(function () { refresh(); }); });
  eventBus.on('shape.removed', function () { _.defer(function () { refresh(); }); });

  // enable/disable tooltips
  function toggleTooltipInfos() {
    if (TOOLTIP_INFOS_ENABLED) {
      TOOLTIP_INFOS_ENABLED = false;
      overlays.remove({ type: 'tooltip-info' });
    } else {
      TOOLTIP_INFOS_ENABLED = true;
      _.defer(function () { refresh(); });
    }
  }

  /**
   * refresh all tooltips for supported bpmn-elements
   */
  function refresh() {
    if (!TOOLTIP_INFOS_ENABLED) {
      return;
    }

    _.forEach(elementRegistry.getAll(), function (element) {
      if (!supportedTypes.includes(element.type)) return;

      var id = element.id + '_tooltip_info';
      cleanTooltip(element);
      addListener(element, id);
      addTooltip(element, id);
    });
  }

  /**
   * add tooltip regarding an element, using the given tooltip-id in html
   */
  function addTooltip(element, tooltipId) {
    elementOverlays[element.id].push(
      overlays.add(
        element, 'tooltip-info',
        overlay(buildTooltipOverlay(element, tooltipId))));
  }

  /**
   * add tooltip header
   */
  function tooltipHeader(element) {
    return '<div class="tooltip-header"> \
              <div class="tooltip-container">'+ element.type.split(':')[1] + '</div>\
            </div>';
  }

  /**
   * container for external task configuration:
   *  - name, id
   * 
   * properties not really needed in popup
   */
  function tooltipGeneral(element) {
    return '<div class="tooltip-container"> \
              <div class="tooltip-subheader">General</div>'
      + tooltipLineText("Id", element.id)
      + tooltipLineText("Name", element.businessObject.name)
      + '</div>';
  }

  /**
   * container for details:
   *  - properties depending on element-type
   *  - e.g. type of implementation
   */
  function tooltipDetails(element) {
    if (element.businessObject == undefined) return '';

    var lines = [];
    var type = element.businessObject.$type;

    if (type == 'bpmn:ServiceTask' || type == 'bpmn:SendTask' || type == 'bpmn:BusinessRuleTask') evaluateServiceSendRuleTask(element, lines);
    if (type == 'bpmn:BusinessRuleTask') evaluateBusinessRuleTask(element, lines);
    if (type == 'bpmn:ReceiveTask') evaluateReceiveTask(element, lines);
    if (type == 'bpmn:ScriptTask') evaluateScriptTask(element, lines);
    if (type == 'bpmn:CallActivity') evaluateCallActivity(element, lines);
    if (type == 'bpmn:UserTask') evaluateUserTask(element, lines);
    if (type == 'bpmn:StartEvent' 
          || type == 'bpmn:EndEvent' 
          || type == 'bpmn:IntermediateCatchEvent' 
          || type == 'bpmn:IntermediateThrowEvent'
          || type == 'bpmn:BoundaryEvent') evaluateEvents(element, lines);

    return addHeaderRemoveEmptyLinesAndFinalize('Details', lines);
  }

  /**
   * container for multi-instance:
   *  - properties depending multi-instance configuration
   *  - e.g. collection, element variable
   */
  function tooltipMultiInstance(element) {
    var lines = [];

    if (element.businessObject.loopCharacteristics != undefined) {
      lines.push(tooltipLineText('Multi Instance', element.businessObject.loopCharacteristics.isSequential ? 'sequential' : 'parallel'));
      if (element.businessObject.loopCharacteristics.loopCardinality != undefined) {
        lines.push(tooltipLineText('Loop Cardinality', element.businessObject.loopCharacteristics.loopCardinality.body));
      }
      lines.push(tooltipLineText('Collection', element.businessObject.loopCharacteristics.collection));
      lines.push(tooltipLineText('Element Variable', element.businessObject.loopCharacteristics.elementVariable));
      if (element.businessObject.loopCharacteristics.completionCondition != undefined) {
        lines.push(tooltipLineText('Completion Condition', element.businessObject.loopCharacteristics.completionCondition.body));
      }

      if (element.businessObject.loopCharacteristics.extensionElements != undefined
        && element.businessObject.loopCharacteristics.extensionElements.values != undefined) {
        var extensionElement = findExtension(element.businessObject.loopCharacteristics.extensionElements.values, 'camunda:FailedJobRetryTimeCycle')
        if (extensionElement != undefined) {
          lines.push(tooltipLineText("MI Retry Time Cycle", extensionElement.body));
        }
      }
    }

    return addHeaderRemoveEmptyLinesAndFinalize('Multi Instance', lines);
  }

  
  /**
   * container for external task configuration:
   *  - external task priority
   */
  function tooltipExternalTaskConfiguration(element) {
    if (element.businessObject == undefined) return '';
    var lines = [];
    lines.push(tooltipLineText('Task Priority', element.businessObject.taskPriority));
    return addHeaderRemoveEmptyLinesAndFinalize('External Task Configuration', lines);
  }

  /**
   * container for asynchronous continuations:
   *  - async before/after indicators
   */
  function tooltipAsynchronousContinuations(element) {
    return '<div class="tooltip-container"> \
              <div class="tooltip-subheader">Asynchronous Continuations</div>'
      + tooltipLineText("Asynch. Before", element.businessObject.asyncBefore ? _html_ok : _html_nok)
      + tooltipLineText("Asynch. After", element.businessObject.asyncAfter ? _html_ok : _html_nok)
      + tooltipLineText("Exclusive", element.businessObject.exclusive ? _html_ok : _html_nok)
      + '</div>';
  }

  /**
   * container for job configuration:
   *  - job priority, retry behaviour
   */
  function tooltipJobConfiguration(element) {
    if (element.businessObject == undefined) return '';

    var lines = [];
    lines.push(tooltipLineText('Job Priority', element.businessObject.jobPriority));

    var retryTimeCycle = findExtensionByType(element, 'camunda:FailedJobRetryTimeCycle')
    if (retryTimeCycle != undefined) {
      lines.push(tooltipLineText('Retry Time Cycle', retryTimeCycle.body));
    }

    return addHeaderRemoveEmptyLinesAndFinalize('Job Configuration', lines);
  }

  /**
   * container for conditional sequence flows:
   *  - evaluate outgoing sequence flows, if they are conditional or default
   */
  function tooltipConditionalOutgoingSequenceFlows(element) {
    if (element.outgoing == undefined || element.outgoing.length <= 1) return '';

    var html = '<div class="tooltip-container"> \
                  <div class="tooltip-subheader">Conditional Sequence-Flows</div>';

    if (element.businessObject.default != undefined) {
      var defaultFlow = element.businessObject.default.id;
    }

    _.each(element.outgoing, function (outgoingFlow) {
      if (outgoingFlow.id == defaultFlow) {
        // default flow (there is only one)
        html += tooltipLineText(outgoingFlow.businessObject.name || _html_na, 'default');

      } else if (outgoingFlow.businessObject.conditionExpression == undefined) {
        // no expression given
        html += tooltipLineText(outgoingFlow.businessObject.name || _html_na, _html_na);

      } else {
        // conditional / script flows 
        var language = outgoingFlow.businessObject.conditionExpression.language;
        if (language != undefined && language.trim().length > 0) {
          var conditionalExpression ='Script Format: ' + language.trim() + '<br />'
          conditionalExpression += outgoingFlow.businessObject.conditionExpression.body.replace(/(?:\r\n|\r|\n)/g, '<br />') || _html_na;
          html += tooltipLineCode(outgoingFlow.businessObject.name || _html_na, conditionalExpression);
        } else {
          var conditionalExpression = outgoingFlow.businessObject.conditionExpression.body || _html_na;
          html += tooltipLineCode(outgoingFlow.businessObject.name || _html_na, conditionalExpression);
        }
      }
    });

    return html += '</div>';
  }

  /**
   * container for documentation:
   * indicates whether documentation is present or not, 
   * it does not show the documentation itself!
   */
  function tooltipDocumentation(element) {
    if (element.businessObject.documentation !== undefined &&
      element.businessObject.documentation.length > 0 &&
      element.businessObject.documentation[0].text.trim().length > 0) {

      return '<div class="tooltip-container"> \
           <div class="tooltip-subheader">Documentation</div>'
        + tooltipLineText("Element Documentation", _html_ok)
        + '</div>';

    } else {
      return '';
    }
  }


  /**
   * evaluate service-/send-/rule-tasks
   */
  function evaluateServiceSendRuleTask(element, lines) {
    if (element.businessObject.class != undefined) {
      lines.push(tooltipLineText('Implementation', 'Java Class'));
      lines.push(tooltipLineCode('Class', element.businessObject.class));
    }

    if (element.businessObject.expression != undefined) {
      lines.push(tooltipLineText('Implementation', 'Expression'));
      lines.push(tooltipLineCode('Expression', element.businessObject.expression));
      lines.push(tooltipLineText('Result Variable', element.businessObject.resultVariable));
    }

    if (element.businessObject.delegateExpression != undefined) {
      lines.push(tooltipLineText('Implementation', 'Delegate Expression'));
      lines.push(tooltipLineCode('Delegate Expression', element.businessObject.delegateExpression));
    }

    if (element.businessObject.type != undefined) {
      lines.push(tooltipLineText('Implementation', 'External'));
      lines.push(tooltipLineCode('Topic', element.businessObject.topic));
    }

    if (findExtensionByType(element, 'camunda:Connector') != undefined) {
      lines.push(tooltipLineText('Implementation', 'Connector'));
    }
  }

  /**
   * evaluate rule-tasks
   */
  function evaluateBusinessRuleTask(element, lines) {
    if (element.businessObject.decisionRef != undefined) {
      lines.push(tooltipLineText('Implementation', 'DMN'));
      lines.push(tooltipLineText('Decision Ref', element.businessObject.decisionRef));
      lines.push(tooltipLineText('Binding', element.businessObject.decisionRefBinding));
      lines.push(tooltipLineText('Tenant Id', element.businessObject.decisionRefTenantId));
      if (element.businessObject.resultVariable != undefined) {
        lines.push(tooltipLineText('Result Variable', element.businessObject.resultVariable));
        lines.push(tooltipLineText('Map Decision Result', element.businessObject.mapDecisionResult));
      }
    }
  }

  /**
   * evaluate receive-tasks
   */
  function evaluateReceiveTask(element, lines) {
    if (element.businessObject.messageRef != undefined) {
      // lines.push(tooltipLineText('Message Id', element.businessObject.messageRef.id));
      lines.push(tooltipLineText('Message Name', element.businessObject.messageRef.name));
    }
  }

  /**
   * evaluate script-tasks
   */
  function evaluateScriptTask(element, lines) {
    lines.push(tooltipLineText('Script Format', element.businessObject.scriptFormat));
    if (element.businessObject.resource != undefined) {
      lines.push(tooltipLineText('Script Type', 'External Resource'));
      lines.push(tooltipLineText('Resource', element.businessObject.resource));
    } else {
      lines.push(tooltipLineText('Script Type', 'Inline Script'));
      lines.push(tooltipLineCode('Script', element.businessObject.script));
    }
    lines.push(tooltipLineText('Result Variable', element.businessObject.resultVariable));
  }

  /**
   * evaluate call-activities
   */
  function evaluateCallActivity(element, lines) {
    if (element.businessObject.calledElement != undefined) {
      lines.push(tooltipLineText('CallActivity Type', 'BPMN'));
      lines.push(tooltipLineText('Called Element', element.businessObject.calledElement));
      lines.push(tooltipLineText('Binding', element.businessObject.calledElementBinding));
      lines.push(tooltipLineText('Version', element.businessObject.calledElementVersion));
      lines.push(tooltipLineText('Version Tag', element.businessObject.calledElementVersionTag));
      lines.push(tooltipLineText('Tenant Id', element.businessObject.calledElementTenantId));
      if (element.businessObject.variableMappingDelegateExpression != undefined) {
        lines.push(tooltipLineText('Delegate Variable Mapping', 'DelegateExpression'));
        lines.push(tooltipLineCode('Delegate Expression', element.businessObject.variableMappingDelegateExpression));
      }
      if (element.businessObject.variableMappingClass != undefined) {
        lines.push(tooltipLineText('Delegate Variable Mapping', 'Class'));
        lines.push(tooltipLineCode('Class', element.businessObject.variableMappingClass));
      }

    } else if (element.businessObject.caseRef != undefined) {
      lines.push(tooltipLineText('CallActivity Type', 'CMMN'));
      lines.push(tooltipLineText('Case Ref', element.businessObject.caseRef));
      lines.push(tooltipLineText('Binding', element.businessObject.caseBinding));
      lines.push(tooltipLineText('Version', element.businessObject.caseVersion));
      lines.push(tooltipLineText('Tenant Id', element.businessObject.caseTenantId));
    }

    var businesskey = findExtensionByType(element, 'camunda:In')
    if (businesskey != undefined) {
      lines.push(tooltipLineText('Busineess Key', _html_ok));
      lines.push(tooltipLineCode('Busineess Key Expression', businesskey.businessKey));
    }
  }

  /**
   * evaluate user-tasks
   */
  function evaluateUserTask(element, lines) {
    lines.push(tooltipLineText('Assignee', element.businessObject.assignee));
    lines.push(tooltipLineText('Candidate Users', element.businessObject.candidateUsers));
    lines.push(tooltipLineText('Candidate Groups', element.businessObject.candidateGroups));
    lines.push(tooltipLineText('Due Date', element.businessObject.dueDate));
    lines.push(tooltipLineText('Follow Up Date', element.businessObject.followUpDate));
    lines.push(tooltipLineText('Priority', element.businessObject.priority));
  }

  /**
   * evaluate events
   */
  function evaluateEvents(element, lines) {
    if (findEventDefinitionType(element, 'bpmn:MessageEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:MessageEventDefinition');
      if (eventDefinition.class != undefined) {
        lines.push(tooltipLineText('Implementation', 'Java Class'));
        lines.push(tooltipLineCode('Class', eventDefinition.class));
      }

      if (eventDefinition.expression != undefined) {
        lines.push(tooltipLineText('Implementation', 'Expression'));
        lines.push(tooltipLineCode('Expression', eventDefinition.expression));
        lines.push(tooltipLineText('Result Variable', eventDefinition.resultVariable));
      }

      if (eventDefinition.delegateExpression != undefined) {
        lines.push(tooltipLineText('Implementation', 'Delegate Expression'));
        lines.push(tooltipLineCode('Delegate Expression', eventDefinition.delegateExpression));
      }

      if (eventDefinition.type != undefined) {
        lines.push(tooltipLineText('Implementation', 'External'));
        lines.push(tooltipLineCode('Topic', eventDefinition.topic));
      }

      if (eventDefinition.extensionElements != undefined && findExtension(eventDefinition.extensionElements.values, 'camunda:Connector') != undefined) {
        lines.push(tooltipLineText('Implementation', 'Connector'));
      }

      if (eventDefinition.messageRef != undefined) {
        // lines.push(tooltipLineText('Message', eventDefinition.messageRef.id));
        lines.push(tooltipLineText('Message Name', eventDefinition.messageRef.name));
      }
    }

    if (findEventDefinitionType(element, 'bpmn:EscalationEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:EscalationEventDefinition');
      if (eventDefinition.escalationRef != undefined) {
        // lines.push(tooltipLineText('Escalation', eventDefinition.escalationRef.id));
        lines.push(tooltipLineText('Escalation Name', eventDefinition.escalationRef.name));
        lines.push(tooltipLineText('Escalation Code', eventDefinition.escalationRef.escalationCode));
        lines.push(tooltipLineText('Escalation Code Variable', eventDefinition.escalationCodeVariable));
      }
    }

    if (findEventDefinitionType(element, 'bpmn:ErrorEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:ErrorEventDefinition');
      if (eventDefinition.errorRef != undefined) {
        // lines.push(tooltipLineText('Error', eventDefinition.errorRef.id));
        lines.push(tooltipLineText('Error Name', eventDefinition.errorRef.name));
        lines.push(tooltipLineText('Error Code', eventDefinition.errorRef.errorCode));
        lines.push(tooltipLineText('Error Message', eventDefinition.errorRef.errorMessage));
        lines.push(tooltipLineText('Error Code Variable', eventDefinition.errorCodeVariable));
        lines.push(tooltipLineText('Error Message Variable', eventDefinition.errorMessageVariable));
      }
    }

    if (findEventDefinitionType(element, 'bpmn:CompensateEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:CompensateEventDefinition');
      lines.push(tooltipLineText('Wait for Completion', eventDefinition.waitForCompletion ? _html_ok : _html_nok));
      if (eventDefinition.activityRef != undefined) {
        lines.push(tooltipLineText('Activity Ref', eventDefinition.activityRef.id));
      }
    }

    if (findEventDefinitionType(element, 'bpmn:SignalEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:SignalEventDefinition');
      if (eventDefinition.signalRef != undefined) {
        // lines.push(tooltipLineText('Signal', eventDefinition.signalRef.id));
        lines.push(tooltipLineText('Signal Name', eventDefinition.signalRef.name));
      }
    }

    if (findEventDefinitionType(element, 'bpmn:TimerEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:TimerEventDefinition');
      if (eventDefinition.timeDate != undefined) {
        lines.push(tooltipLineText('Timer', 'Date'));
        lines.push(tooltipLineText('Timer Definition', eventDefinition.timeDate.body));
      }
      if (eventDefinition.timeDuration != undefined) {
        lines.push(tooltipLineText('Timer', 'Duration'));
        lines.push(tooltipLineText('Timer Definition', eventDefinition.timeDuration.body));
      }
      if (eventDefinition.timeCycle != undefined) {
        lines.push(tooltipLineText('Timer', 'Cycle'));
        lines.push(tooltipLineText('Timer Definition', eventDefinition.timeCycle.body));
      }
    }

    if (findEventDefinitionType(element, 'bpmn:ConditionalEventDefinition') != undefined) {
      var eventDefinition = findEventDefinitionType(element, 'bpmn:ConditionalEventDefinition');
      lines.push(tooltipLineText('Variable Name', eventDefinition.variableName));
      lines.push(tooltipLineText('Variable Event', eventDefinition.variableEvent));
      if (eventDefinition.condition != undefined && eventDefinition.condition.language != undefined) {
        lines.push(tooltipLineText('Condition Type', 'Script'));
        lines.push(tooltipLineText('Script Format', eventDefinition.condition.language));
        if (eventDefinition.condition.resource != undefined) {
          lines.push(tooltipLineText('Script Type', 'External Resource'));
          lines.push(tooltipLineText('Resource', eventDefinition.condition.resource));
        } else {
          lines.push(tooltipLineText('Script Type', 'Inline Script'));
          lines.push(tooltipLineCode('Script', eventDefinition.condition.body.replace(/(?:\r\n|\r|\n)/g, '<br />')));
        }
      } else {
        lines.push(tooltipLineText('Condition Type', 'Expression'));
        lines.push(tooltipLineCode('Expression', eventDefinition.condition.body));
      }
    }

    lines.push(tooltipLineText('Initiator', element.businessObject.initiator));
  }


  /* >-- helpers for bpmn-elements --< */

  function findExtensionByType(element, type) {
    if (element == undefined
      || element.businessObject == undefined
      || element.businessObject.extensionElements == undefined
      || element.businessObject.extensionElements.values == undefined
      || element.businessObject.extensionElements.values.length == 0)
      return undefined;
    return findExtension(element.businessObject.extensionElements.values, type);
  }


  function findExtension(values, type) {
    return _.find(values, function (value) { return value.$type == type; });
  }


  function findEventDefinitionType(element, type) {
    if (element == undefined
      || element.businessObject == undefined
      || element.businessObject.eventDefinitions == undefined
      || element.businessObject.eventDefinitions.length == 0)
      return undefined;
    return _.find(element.businessObject.eventDefinitions, function (value) { return value.$type == type; });
  }


  /* >-- methods to assemble tooltip lines --< */

  /**
   * add a single tooltip line as 'text' 
   */
  function tooltipLineText(key, value) {
    return tooltipLineWithCss(key, value, 'tooltip-value-text');
  }

  /**
   * add a single tooltip line as 'code' 
   */
  function tooltipLineCode(key, value) {
    return tooltipLineWithCss(key, value, 'tooltip-value-code');
  }

  /**
   * add a single tooltip line as <div> with 2 <span>, 
   * like: <div><span>key: </span><span class="css">value</span></div>
   */
  function tooltipLineWithCss(key, value, css) {
    if (value == undefined) return '';
    return `<div class="tooltip-line"><span class="tooltip-key">${key}:&nbsp;</span><span class="tooltip-value ${css}">${value}</span></div>`;
  }

  /**
   * create a tooltip-container with header (e.g. 'Details') and add all respective properties.
   * if there is no property present, the container is not created.
   */
  function addHeaderRemoveEmptyLinesAndFinalize(subheader, lines) {
    var final = _.without(lines, "");
    if (final.length == 0) return '';

    var html = '<div class="tooltip-container"> \
                  <div class="tooltip-subheader">' + subheader + '</div>';

    _.each(final, function (line) {
      html += line;
    });

    return html += '</div>';
  }

  /**
   * show some hint in tooltip, if no relevant property was found,
   * otherwise join all lines that include some information
   */
  function emptyPropertiesIfNoLines(lines) {
    var final = _.without(lines, "");
    if (final.length == 0) {
      return `<div class="tooltip-no-properties ">${_html_no_properties_found}</div>`;
    }
    return final.join('');
  }

  /**
   * build a complete tooltip-overlay-html, consisting of header, and 
   * detail-containers, if any information is, otherwise show resp. hint.
   * 
   * some containers are disabled currently, bc. the information is not really needed
   * to show in tooltip, or can be visualized by other plugins already. 
   */
  function buildTooltipOverlay(element, tooltipId) {
    return '<div id="' + tooltipId + '" class="tooltip"> \
              <div class="tooltip-content">'
                + tooltipHeader(element)
                + emptyPropertiesIfNoLines([
                    // tooltipGeneral(element)
                    tooltipDetails(element),
                    tooltipMultiInstance(element),
                    tooltipExternalTaskConfiguration(element),
                    // tooltipAsynchronousContinuations(element)
                    tooltipJobConfiguration(element),
                    tooltipConditionalOutgoingSequenceFlows(element)
                    // tooltipDocumentation(element)
                ])
                + '</div> \
            </div>';
  }

  /**
   * create tooltip-overlay with options and content
   */
  function overlay(html) {
    return {
      position: { top: -30, left: 0 },
      scale: false,
      show: { maxZoom: 2 },
      html: html
    }
  }

  /**
   * clean up an element from overlays
   */
  function cleanTooltip(element) {
    if (elementOverlays[element.id] !== undefined && elementOverlays[element.id].length !== 0) {
      for (var overlay in elementOverlays[element.id]) {
        overlays.remove(elementOverlays[element.id][overlay]);
      }
    }
    elementOverlays[element.id] = [];
  }

  /**
   * add listeners to an element, that are responsible for showing/hinding the
   * tooltip if the cursor hovers the element
   */
  function addListener(element, tooltipId) {
    $('[data-element-id="' + element.id + '"]')
      .hover(
        function () { $('#' + tooltipId).show(); },
        function () { $('#' + tooltipId).hide(); }
      );
  }

} // end of TooltipInfoService


var elementOverlays = [];
const _html_ok = '&#10004;';
const _html_nok = '&#10006;';
const _html_na = 'n/a';
const _html_no_properties_found = 'no relevant properties found';
const supportedTypes = [
  'bpmn:CallActivity',
  'bpmn:BusinessRuleTask',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ManualTask',
  'bpmn:ReceiveTask',
  'bpmn:ScriptTask',
  'bpmn:SendTask',
  'bpmn:ServiceTask',
  'bpmn:SubProcess',
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent'
];

TooltipInfoService.$inject = [
  'eventBus',
  'overlays',
  'elementRegistry',
  'editorActions'
];

module.exports = {
  __init__: ['TOOLTIP_INFO_MODULE'],
  TOOLTIP_INFO_MODULE: ['type', TooltipInfoService]
};
