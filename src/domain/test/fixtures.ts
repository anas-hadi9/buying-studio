import type { RawCell, RawSheet } from '../import/sheet'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** A small synthetic sheet shaped like a vendor OTB line list (no real data). */
export function lineListSheet(): RawSheet {
  const header: RawCell[] = [
    'Style',
    'Item No',
    'Color Desc',
    'Gender',
    'Line',
    'Category',
    'Story',
    'Season',
    'Psf',
    'Turkey Retail Price, Tl',
    'Type Of Production ',
    'Vat %',
    'Photo Hyperlink',
    'Deadline',
    'Available to Ship',
    'Style Description',
    'Composition In Percentage',
  ]
  const rows: RawCell[][] = [
    ['1001', '1001-052', 'Black', 'WOMEN', 'SHIRT', 'SHIRT', 'COASTAL VİEW', 'SS27', 8999, 0, 'Woven', 0.1, 'https://img.example/1001-052.jpg', 'January', d('2027-01-01'), 'Linen Shirt', '100% LI'],
    ['1001', '1001-170', 'Ecru', 'WOMEN', 'SHIRT', 'SHIRT', 'COASTAL VİEW', 'SS27', 8999, 7999, 'Woven', 0.1, 'https://img.example/1001-170.jpg', 'January', d('2027-01-01'), 'Linen Shirt', '100% LI'],
    ['1002', '1002-291', 'Dark Blue', 'MAN', 'PANTS', 'TROUSERS', 'SUNSET', 'FW26', 11999, 0, 'Woven', 0.1, 'https://img.example/1002-291.jpg', 'March', d('2027-03-01'), 'Slim Fit Pants', '97% CO 3% EA'],
    ['1003', '1003-052', 'Black', 'MAN', 'TSHIRT', 'TSHIRT', null, 'SS26', 2599, 0, 'Knitted', 0.1, null, 'February', d('2027-02-01'), 'Basic T-Shirt', '73% CO 21% PES 6% EA'],
    [1004, '1004-107', 'Brown', 'MAN', 'BELT', 'BELT', 'SHOES&BAG', 'SS27', 3999, 3999, 'Leather', 0.2, 'https://img.example/1004-107.jpg', d('2027-02-20'), d('2027-02-20'), 'Leather Belt', '100% LEA'],
  ]
  return { name: 'Items', hidden: false, data: [header, ...rows] }
}

export function pivotSheet(): RawSheet {
  return {
    name: 'WOMAN',
    hidden: false,
    data: [
      ['Gender', 'WOMEN', null],
      [null, null, null],
      ['Row Labels', 'Distinct Count of Style', 'Count of Item No'],
      ['D1', 79, 102],
      ['D2', 45, 50],
    ],
  }
}
