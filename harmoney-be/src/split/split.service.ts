import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

export interface Item {
  id: string;
  name: string;

  // harga satuan
  price: number;

  // jumlah barang
  qty: number;

  // total harga
  total_price: number;

  // participant
  shared_with: string[];
}

export interface SessionData {
  friends: string[];
  items: Item[];
  grand_total: number;
  date?: string;
}

@Injectable()
export class SplitService {
  private sessions = new Map<string, SessionData>();

  // =========================
  // SESSION
  // =========================

  getOrCreateSession(sid: string): SessionData {
    if (!this.sessions.has(sid)) {
      this.sessions.set(sid, {
        friends: ['Me'],
        items: [],
        grand_total: 0,
      });
    }

    return this.sessions.get(sid)!;
  }

  getSession(sid: string) {
    return this.getOrCreateSession(sid);
  }

  // =========================
  // OCR
  // =========================

  async callOcrService(
    file: Express.Multer.File,
  ): Promise<any> {
    const formData = new FormData();

    formData.append('image', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    try {
      const response = await axios.post(
        'http://127.0.0.1:5000/scan-receipt',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(error);

      throw new InternalServerErrorException(
        'Gagal menghubungi Python AI Service',
      );
    }
  }

  // =========================
  // OCR -> SESSION
  // =========================

  syncOcrToSession(
    sid: string,
    pythonRawResponse: any,
  ) {
    const session = this.getOrCreateSession(sid);

    const ocrData = pythonRawResponse.data;

    if (
      pythonRawResponse.success &&
      ocrData.items
    ) {
      session.date = ocrData.date;

      session.items = ocrData.items.map(
        (item: any, index: number) => {
          const qty = item.quantity || 1;

          const pricePerItem =
            item.price || 0;

          const totalPrice =
            item.total_price ||
            pricePerItem * qty;

          return {
            id: `item_${Date.now()}_${index}`,

            name: item.name,

            price: pricePerItem,

            qty,

            total_price: totalPrice,

            // kosong dulu
            shared_with: [],
          };
        },
      );

      this.recalculateGrandTotal(session);
    }

    return session;
  }

  // =========================
  // FRIENDS
  // =========================

  addFriend(
    sid: string,
    name: string,
  ) {
    const session = this.getOrCreateSession(sid);

    if (!name?.trim()) {
      return session;
    }

    if (
      !session.friends.includes(name)
    ) {
      session.friends.push(name);
    }

    return session;
  }

  editFriend(
    sid: string,
    oldName: string,
    newName: string,
  ) {
    const session = this.getOrCreateSession(sid);

    const index =
      session.friends.indexOf(oldName);

    if (index === -1) {
      return session;
    }

    session.friends[index] = newName;

    // update assignment item
    session.items.forEach((item) => {
      item.shared_with =
        item.shared_with.map((f) =>
          f === oldName ? newName : f,
        );
    });

    return session;
  }

  deleteFriend(
    sid: string,
    name: string,
  ) {
    const session = this.getOrCreateSession(sid);

    // "Me" tidak boleh dihapus
    if (name === 'Me') {
      return session;
    }

    session.friends =
      session.friends.filter(
        (f) => f !== name,
      );

    // remove dari assignment
    session.items.forEach((item) => {
      item.shared_with =
        item.shared_with.filter(
          (f) => f !== name,
        );
    });

    return session;
  }

  // =========================
  // ITEMS
  // =========================

  addItem(
    sid: string,
    body: {
      name: string;
      qty: number;
      price: number;
    },
  ) {
    const session = this.getOrCreateSession(sid);

    const qty = body.qty || 1;
    const price = body.price || 0;

    session.items.push({
      id: `manual_${Date.now()}`,

      name: body.name,

      qty,

      price,

      total_price: qty * price,

      shared_with: [],
    });

    this.recalculateGrandTotal(session);

    return session;
  }

  editItem(
    sid: string,
    itemId: string,
    body: Partial<Item>,
  ) {
    const session = this.getOrCreateSession(sid);

    const item = session.items.find(
      (i) => i.id === itemId,
    );

    if (!item) {
      return session;
    }

    item.name =
      body.name ?? item.name;

    item.qty =
      body.qty ?? item.qty;

    item.price =
      body.price ?? item.price;

    item.total_price =
      item.qty * item.price;

    this.recalculateGrandTotal(session);

    return session;
  }

  deleteItem(
    sid: string,
    itemId: string,
  ) {
    const session = this.getOrCreateSession(sid);

    session.items =
      session.items.filter(
        (i) => i.id !== itemId,
      );

    this.recalculateGrandTotal(session);

    return session;
  }

  // =========================
  // ASSIGN
  // =========================

  assignItem(
    sid: string,
    itemId: string,
    friends: string[],
  ) {
    const session = this.getOrCreateSession(sid);

    const item = session.items.find(
      (i) => i.id === itemId,
    );

    if (item) {
      const validFriends =
        friends.filter((f) =>
          session.friends.includes(f),
        );

      item.shared_with =
        validFriends;
    }

    return session;
  }

  // =========================
  // SUMMARY
  // =========================

  getSummary(sid: string) {
    const session = this.getOrCreateSession(sid);

    const participants =
      session.friends.map((friend) => {
        const friendItems =
          session.items.filter((item) =>
            item.shared_with.includes(
              friend,
            ),
          );

        const totalBill =
          friendItems.reduce(
            (acc, item) => {
              if (
                item.shared_with.length ===
                0
              ) {
                return acc;
              }

              const portion =
                item.total_price /
                item.shared_with.length;

              return acc + portion;
            },
            0,
          );

        return {
          name: friend,

          total: Math.round(totalBill),

          items: friendItems.map((i) => ({
            name: i.name,

            qty: i.qty,

            unit_price: i.price,

            total_price:
              i.total_price,

            portion_price:
              i.shared_with.length > 0
                ? Math.round(
                    i.total_price /
                      i.shared_with
                        .length,
                  )
                : 0,
          })),
        };
      });

    return {
      participants,

      grand_total:
        session.grand_total,

      date: session.date,
    };
  }

  // =========================
  // UTIL
  // =========================

  private recalculateGrandTotal(
    session: SessionData,
  ) {
    session.grand_total =
      session.items.reduce(
        (acc, item) =>
          acc + item.total_price,
        0,
      );
  }
}