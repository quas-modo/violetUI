import React, { useEffect, useState, useRef } from 'react'
import cn from 'classnames'
import './cascader.scss'
import produce from 'immer'
import { useClickAway } from 'react-use'

export interface ProcessedOption {
  value: string | number
  label: React.ReactNode
  index?: string
  isSelected?: boolean
  disabled?: boolean
  isFatherSelected?: boolean
  children?: ProcessedOption[]
  isLeaf?: boolean // 是否是叶子节点
}

interface ICascader {
  /** 禁用 */
  disabled?: boolean
  /** 当此项为 true 时，点选每级菜单选项值都会发生变化 */
  changeOnSelect?: boolean
  /** 自定义输入框类名 */
  inputClassName?: string
  /** 自定义浮层类名 */
  popupClassName?: string
  /** 次级菜单的展开方式，可选 'click' 和 'hover' */
  expandTrigger?: string
  /** 当下拉列表为空时显示的内容 */
  notFoundContent?: string
  /** 输入框占位文本 */
  placeholder?: string
  /** 可选项数据源 */
  options: ProcessedOption[]
  /** 浮层预设位置 */
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'
  /** 设置校验状态 */
  status?: 'default' | 'error' | 'success'
  /** 指定选中项 */
  value: React.ReactNode[]
  /** 选择完成后的回调 */
  onChange: (value: React.ReactNode[]) => void
  /** 自定义下拉框内容 */
  dropdownRender?: (menus: React.ReactNode) => React.ReactNode
}

/**
 * > 级联选择框。
 *
 * ### 何时使用
 * - 需要从一组**相关联**的数据集合进行选择，例如省市区，公司层级，事物分类等。
 * - 从一个**较大的数据集合**中进行选择时，用多级分类进行分隔，方便选择。
 * - 比起 `Select` 组件，可以在同一个浮层中完成选择，有较好的体验。
 */
export const Cascader: React.FC<ICascader> = ({
  disabled = false,
  changeOnSelect = false,
  inputClassName,
  popupClassName,
  expandTrigger = 'click',
  notFoundContent = 'nothing here...',
  placeholder,
  options,
  placement = 'bottomLeft',
  status = 'default',
  value,
  onChange,
  dropdownRender,
}) => {
  const inputClasses = cn('violetCascaderWrap__input', inputClassName, {
    'violetCascaderWrap__input--disabled': disabled,
    [`violetCascaderWrap__input--${status}`]: status !== 'default',
  })
  const popupClasses = cn(
    'violetCascaderWrap__optionsWrap',
    `violetCascaderWrap__optionsWrap--${placement}`,
    popupClassName
  )

  // 输入框显示的值
  const displayValue = value.join(' / ')

  // 控制浮层的出现
  const [isPopupShow, setPopupShow] = useState(false)
  const handleInputMouseDown = () => {
    if (!isPopupShow) setPopupShow(true)
  }
  const cascaderInput = useRef(null)
  const popup = useRef(null)
  useClickAway(popup, e => {
    if (!(e.target === cascaderInput.current) && isPopupShow) {
      setPopupShow(false)
    }
  })

  // 浮层的列表内容  content结构:[[option, option, ..], [..], [..], ..]
  const [content, setContent] = useState<Array<ProcessedOption[]>>([])

  useEffect(() => {
    const queue = []
    if (options?.length) {
      // 把第一级推入队列
      for (let i = 0; i < options.length; i++) {
        const processedOption = {
          ...options[i],
          isSelected: false,
          isFatherSelected: true, // 第一级始终显示
          index: i.toString(), // 添加索引
          isLeaf: options[i].children ? false : true,
        } as ProcessedOption
        queue.push(processedOption)
      }
    }
    // 把children推入队列
    while (queue.length) {
      const queueSize = queue.length
      const curLevel = [] as ProcessedOption[]
      for (let i = 0; i < queueSize; i++) {
        const headItem = queue.shift() as ProcessedOption
        const item = {
          value: headItem.value,
          label: headItem.label,
          disabled: headItem.disabled,
          index: headItem.index,
          isSelected: false,
          isFatherSelected: headItem.isFatherSelected,
          isLeaf: headItem.children ? false : true,
        }
        curLevel.push(item)
        // 如果不是disabled，把children推入队尾
        if (!headItem.disabled && headItem.children) {
          for (let i = 0; i < headItem.children.length; i++) {
            const item = {
              value: headItem.children[i].value,
              label: headItem.children[i].label,
              disabled: headItem.children[i].disabled,
              children: headItem.children[i].children,
              index: `${headItem.index}-${i}`, // 注意索引值
              isSelected: false,
            }
            queue.push(item)
          }
        }
      }

      if (curLevel.length) {
        setContent(
          produce(draft => {
            draft.push(curLevel)
          })
        )
      }
    }
  }, [])

  // 选择决定的值
  const [newVal, setNewVal] = useState<React.ReactNode[]>([])
  useEffect(() => {
    setNewVal([])
    content.forEach(options => {
      options.forEach(option => {
        if (option.isSelected) {
          setNewVal(
            produce(draft => {
              draft.push(option.label)
            })
          )
        }
      })
    })
  }, [content])
  // 触发onChange
  if (changeOnSelect) {
    onChange(newVal)
  } else {
    if (content.length && content.length === newVal.length) {
      onChange(newVal)
    }
  }

  // select option
  const handleSelectOption = (option: ProcessedOption) => {
    // 不是叶子节点时
    if (!option.isLeaf) {
      setContent(
        produce(draft => {
          // 找到option，并修改它的isSelect
          for (let i = 0; i < content.length; i++) {
            for (let j = 0; j < content[i].length; j++) {
              if (content[i][j].index === option.index) {
                // 同级所有item先变为false
                for (let x = 0; x < content[i].length; x++) {
                  draft[i][x].isSelected = false
                }
                // 当前item的isSelect变成true
                draft[i][j].isSelected = true
                // 修改children的isFatherSelected
                draft[i + 1].forEach(option => {
                  if (
                    option.index?.substring(0, option.index.length - 2) ===
                    draft[i][j].index
                  ) {
                    option.isFatherSelected = true
                  }
                })
              }
            }
          }
        })
      )
    } else {
      // 是叶子节点时
      setContent(
        produce(draft => {
          // 找到option，修改isSelect
          for (let i = 0; i < content.length; i++) {
            for (let j = 0; j < content[i].length; j++) {
              if (content[i][j].index === option.index) {
                // 同级所有item先变为false
                for (let x = 0; x < content[i].length; x++) {
                  draft[i][x].isSelected = false
                }
                // 当前item的isSelect变成true
                draft[i][j].isSelected = true
              }
            }
          }
        })
      )
    }
  }

  return (
    <div className="violetCascaderWrap">
      <input
        ref={cascaderInput}
        type="text"
        className={inputClasses}
        placeholder={placeholder}
        value={displayValue}
        onChange={() => {
          return
        }}
        onMouseDown={handleInputMouseDown}
        disabled={disabled}
      />
      {/* 下拉icon */}
      <div className="violetCascaderWrap__downIcon"></div>
      {/* 浮层 */}
      {isPopupShow && (
        <div className={popupClasses} ref={popup}>
          {content.length ? (
            content.map((options, index) => (
              // 每个列表
              <ul key={index} className="violetCascaderWrap__optionsWrap__list">
                {options.map(
                  (option, index) =>
                    // 每一项
                    option.isFatherSelected && (
                      <li
                        key={index}
                        className={cn(
                          'violetCascaderWrap__optionsWrap__list__item',
                          {
                            'violetCascaderWrap__optionsWrap__list__item--selected':
                              option.isSelected,
                          }
                        )}
                        onClick={() => handleSelectOption(option)}
                      >
                        {option.label}
                        {/* icon */}
                        <div className="violetCascaderWrap__optionsWrap__list__item__iconBox">
                          {'>'}
                        </div>
                      </li>
                    )
                )}
              </ul>
            ))
          ) : (
            <span className="violetCascaderWrap__optionsWrap__notFound">
              {notFoundContent}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default Cascader